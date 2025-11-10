// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// import * as myData from "../mymodule/myData.js"

import express from 'express'
import { MongoClient, ObjectId } from 'mongodb'
import bcrypt from 'bcrypt';
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import mainAuth from "../middleware/mainAuth.js" 
const myModule = await import(`../${mymoduleFolder}/myModule.js`) ;
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`) ;
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`) ;
const myData = await import(`../${mymoduleFolder}/myData.js`)
const router = express.Router()
const PATH_MAIN = '/user'
const PATH_SAVE = `${PATH_MAIN}/save`
const PATH_CHANGE_PASSWORD = `${PATH_MAIN}/change-password`  
const PATH_UPLOAD = `${PATH_MAIN}/upload`
const SIGNATURE_SUFFIX = "_SIGNATURE"


//=======================================================
// หน้าแรก user
// 
router.get(PATH_MAIN, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)

  try{
    const html = await myModule.renderView('userInfo', res, {
      title: PAGE_USER_INFO ,
      time: myDateTime.getDate(),
      user : await myUsers.getUserData(req) , // ต้องจับจากฐานข้อมูล
      ...await myModule.getSettings() ,
      msg: req.flash('msg'),
      pwd: req.flash('pwd'),
      //
      PATH_MAIN,
      PATH_SAVE,
      PATH_CHANGE_PASSWORD,
      PATH_UPLOAD
    })
    return res.send(html)
  }catch(err){
    console.log(err.message)
    res.status(404).sendFile(file404)
  } 
})




//=======================================================
// ใช้กับทั้ง Create และ Update
// 
router.post(PATH_SAVE, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)
  // req.body ===>  {
  //   rpp: '',
  //   sip: '',
  //   page: '',
  //   load_id: '',
  //   userId: '1000',
  //   _id: '68b93215ab6052cca7343bcd',
  //   username: 'wasankds',
  //   userEmail: 'wasankds@gmail.com',
  //   userPhone: '0814598343',
  //   userPrefix: 'นาย',
  //   userFirstname: 'Wasan2',
  //   userLastname: 'Khunnadiloksawet2'
  // }


  //=== 1.) ค่าจาก req.body - ไม่เหมือนใน manageUsers เขียนได้เฉพาะบางค่าที่ไม่สำคัญเท่านั้น
  const _id = req.body._id
  delete req.body._id // ต้องลบออกด้วยไม่เช่นนั้นจะ error เพราะแก้ไข _id ไม่ได้
  const userId = req.body.userId ? Number(req.body.userId) : req.body.userId
  const username = req.body.username?.trim()   // ห้ามซ้ำ
  const userEmail = req.body.userEmail?.trim() // ห้ามซ้ำ
  req.body.userId = req.body.userId ? Number(req.body.userId) : req.body.userId

  const redirect_Url = PATH_MAIN

  //=== 2.) ตรวจสอบรูปแบบของ username และ email
  const usernameRegex = new RegExp(USERNAME_PATTERN)
  if (!usernameRegex.test(username)) {
    req.flash('msg', { class:"red", text:USERNAME_DESCRIPTION })
    return res.redirect(redirect_Url)
  }

  //=== 3.) ตรวจสอบรูปแบบของ email - อาจไม่มี email
  if(userEmail){
    const emailRegex = new RegExp(EMAIL_PATTERN)
    if (!emailRegex.test(userEmail)) {
      req.flash('msg', { class:"red", text:`รูปแบบอีเมลไม่ถูกต้อง` })
      return res.redirect(redirect_Url)
    }
  }

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_users = db.collection(global.dbColl_users)

    //=== 4) ตรวจสอบการซ้ำ (ยกเว้นตัวเอง)
    // - มี username หรือ email นี้ในระบบหรือไม่ 
    var userOtherFind = await coll_users.findOne({
      _id: { $ne: new ObjectId(_id) } , // ไม่ใช่ตัวเอง
      $or: [
        { userEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
        { username: { $regex: new RegExp(`^${username}$`, 'i') } },
      ],
    })
    if (userOtherFind) {
      req.flash('msg', { class:"red", text:`อีเมล/ชื่อผู้ใช้นี้ ถูกใช้โดยผู้ใช้อื่นแล้ว` })
      return res.redirect(redirect_Url)
    }

    //=== 5) ถ้าเปลี่ยนฟิลด์ที่มีผลต่อไปนี้ ให้ลบ session ทั้งหมดของ user
    // - ให้ลบ session ทั้งหมดของ user
    const userMe_before = await coll_users.findOne({ _id: new ObjectId(_id) })
    const isSameArr = [
      userMe_before.username == req.body.username ,   // แก้ชื่อผู้ใช้
      userMe_before.userEmail == req.body.userEmail , // เปลี่ยนอีเมล
    ]

    //=== 6)  Update ข้อมูล
    const updateQuery = { $set: req.body }
    var rtn = await coll_users.updateOne(
      { _id: new ObjectId(_id) },
      updateQuery,
      { upsert: false }
    )

    //=== 7.) ผลลัพธ์การอัปเดต
    if (rtn.acknowledged && rtn.modifiedCount == 1) {

      let msg = `อัปเดท ${userId} เรียบร้อยแล้ว`
      
      //== 7.1) เก็บ changes
      const changes = myData.getChangeHistory(userMe_before, req.body);
      if (changes && changes.length > 0) {
        const changeHistoryObj = {
          dateTime : myDateTime.getDateTime() ,
          userId : userId ,
          userFullname : `${userMe_before.userPrefix} ${userMe_before.userFirstname} ${userMe_before.userLastname}` ,
          changes : changes,
        }
        //= Update History - เพิ่มข้อมูลการอัปเดท
        await coll_users.updateOne(
          { userId: userId },
          { $push: { changesHistory: { $each: [changeHistoryObj], $position: 0 } } }
        ) 
        msg += `{{sep}}[ บันทึกการแก้ไข ]`
      } 

      //== 7.2) ลบ session ทั้งหมดของ user 
      // - ถ้า user แก้ไขข้อมูลตัวเองที่สำคัญ - บังคับ user Logout
      if( isSameArr.includes(false) ){
        // ลบ session ทั้งหมดของ user
        const coll_sessions = db.collection(global.dbColl_sessions)
        await coll_sessions.deleteMany({"session.user_id": _id })
        // Logout ทันที 
        req.session.destroy( (err) => {
          if(err) console.log("Session destroy error: ", err);
          return res.redirect('/')
        })
      }else{
        req.flash('msg', { class: "green", text:msg })
        return res.redirect(redirect_Url)
      }
    } else if (rtn.acknowledged && (rtn.modifiedCount < 1 || rtn.upsertedCount < 1)) {
      req.flash('msg', { class: "yellow", text: `ไม่มีการเปลี่ยนแปลงข้อมูลของ "${userId}"` })
      return res.redirect(redirect_Url)
    } else {
      req.flash('msg', { class: "red", text: `เกิดข้อผิดพลาด ไม่พบข้อมูลของ{{sep}}"${userId}"` })
      return res.redirect(redirect_Url)
    }
  } catch (err) {
    console.log("error ===> ", err.message);
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }

})


//==================================
// สำหรับให้ยูสเซอร์เปลี่ยนพาสเวิร์ดเอง
// - ถูกเรียกใช้จากหน้า mycourses
// - ส่ง flase(pwd) ไปให้หน้า mycourses ฉะนั้น หน้า mycourses ต้องเขียนรับด้วย
// 
router.post(PATH_CHANGE_PASSWORD, mainAuth.isAuth, async (req,res) => {
  // console.log(`--------${req.originalUrl}--------`)
  // console.log("req.body ===> " , req.body)

  // 
  const _id = req.body._id
  const username = req.body.username
  const newPassword = req.body.newPassword
  const confirmPassword = req.body.confirmPassword

  const redirectUrl = PATH_MAIN
  const redirectError = `/login`

  //=== ตรวจสอบว่า newPassword กับ confirmPassword ตรงกันหรือไม่
  if(newPassword != confirmPassword){
    req.flash('msg', { class:"red", text: `"รหัสผ่านใหม่" และ "ยืนยันรหัสผ่านใหม่" ไม่ตรงกัน` })
    req.flash('pwd', { newPassword:newPassword , confirmPassword:confirmPassword })
    return res.redirect(redirectUrl)
  }

  //=== ตรวจสอบรูปแบบของพาสเวิร์ด
  const passwordRegex = new RegExp(PASSWORD_PATTERN)
  if (!passwordRegex.test(newPassword)) {
    req.flash('msg', {  class: "red", text: PASSWORD_DESCRIPTION })
    req.flash('pwd', { newPassword: newPassword, confirmPassword: confirmPassword })
    return res.redirect(redirectUrl)
  }

  //=== 
  const client = await MongoClient.connect(dbUrl);
  try{
    const db = client.db(dbName);
    const collection = db.collection(dbColl_users)

    //=== ค้นหายูสเซอร์
    const userFind = await collection.findOne({ _id:new ObjectId(_id)})
    if (!userFind) {
      req.flash('msg', { class:"red", text:`User "${username}" not found `})
      req.flash('pwd', { newPassword:newPassword, confirmPassword:confirmPassword })
      return res.redirect(redirectUrl); 
    }

    //==== เข้ารหัสพาสเวิร์ดใหม่ - แล้วอัปเดตแทนของเก่า 
    const newPasswordEncrypt = await bcrypt.hash(newPassword, 12)
    const updateRtn = await collection.updateOne(
      { _id:new ObjectId(_id)} ,
      { $set: { userPassword: newPasswordEncrypt } }
    )

    // console.log("updateRtn  ===> ", updateRtn)
    if(updateRtn.matchedCount == 1 && updateRtn.modifiedCount <= 0){
      req.flash('pwd', { newPassword:newPassword , confirmPassword:confirmPassword ,})
      req.flash('msg', { class:"yellow",text:`พาสเวิร์ดเก่ากับใหม่เป็นตัวเดียวกัน`})
      return res.redirect(redirectUrl)
    }else if(updateRtn.matchedCount == 1 && updateRtn.modifiedCount > 0){      
      req.flash('pwd', { newPassword:'', confirmPassword : '' })
      req.flash('msg', {class:"green", text:`เปลี่ยนพาสเวิร์ดเรียบร้อยแล้ว` })
      return res.redirect(redirectUrl)
    }else{
      req.flash('pwd', { newPassword:newPassword , confirmPassword:confirmPassword ,})
      req.flash('msg', { class : "red", text : `เกิดข้อผิดพลาดขณะเปลี่ยนรหัสผ่านของคุณ` })
      return res.redirect(redirectUrl)
    }
  }catch(err){
    // console.log(err.message)
    req.flash('msg', { class : "red", text : err.message })
    return res.redirect(redirectError)
  }finally{
    client.close()
  }
})



//==============================================
//
// - ก็อปปี้จาก manageUsersRouter มาวางเลย
// - มันจะต่างกันตรง PATH_MAIN ทำให้ Redirect ต่างกัน
// 
const uploadSignature = multer({
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        await fs.promises.mkdir(global.folderUsers, { recursive: true });
        cb(null, global.folderUsers);
      } catch (err) {
        cb(err);
      }
    },
    filename: function (req, file, cb) {
      const userId = req.body.userId; // ตั้วชื่อไฟล์ภาพ
      const ext = path.extname(file.originalname).toLowerCase();
      // console.log("filename ===> ", `${userId}${SIGNATURE_SUFFIX}${ext}`)
      // ตั้งชื่อไฟล์ เช่น 1001_SIGNATURE.png
      cb(null, `${userId}${SIGNATURE_SUFFIX}${ext}`);
    }
  }),
  limits: { fileSize: 1024 * 1024 * 1 }, // 1MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.png') {
      cb(null, true);
    } else {
      cb(new Error('Only .png files are allowed!'));
    }
  }
}).single('userImageSignature');
//================================================================
// Centralized Error Handling Middleware
// 
const handleMulterError_uploadSignature = async (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // console.error("Multer Error:", err.message);
    req.flash('msg', { class: "red", text: `Upload error#1: ${err.message}` });
    res.redirect(`${PATH_MAIN}`)
  } else if (err) { // An unknown error occurred.
    console.error("Unknown Upload Error:", err);
    req.flash('msg', { class: "red", text: `Upload error#2: ${err.message}` });
    res.redirect(`${PATH_MAIN}`);
  } else { // No error, continue to the next middleware
    next() 
  }
}
//==== 
router.post(PATH_UPLOAD, [ 
    mainAuth.isOA ,         // 1
    ( req, res, next) => { // 2 - อัปโหลดไฟล์ (เขียนแบบนี้เพราะต้องการ handleMulterError)
      uploadSignature(req, res, (err) => {
        if (err) {
          return handleMulterError_uploadSignature(err, req, res, next)
        }
        next()
      })
    } 
  ], async (req,res) => {
    try {  
      // console.log(`-----------------${req.originalUrl}----------------------`)
      // console.log("req.body ===> " , req.body)
      // req.body ===>  [Object: null prototype] {
      //   rpp: '20',
      //   sip: '',
      //   page: '1',
      //   load_id: '689820355c2d571465b1835b',
      //   userId: '1000'
      // }

      const sip = req.body.sip?.toString().replace(/[!@#$%^&*\///]/g, '')??''
      const rpp = Number(req.body.rpp) || 30
      const page = Number(req.body.page) || 1
      const load_id = req.body.load_id

      const sip_query = sip ? `&sip=${sip}` : ''
      const rpp_query = rpp ? `&rpp=${rpp}` : ''
      const page_query = page ? `&page=${page}` : ''
      const load_id_query = load_id ? `&load_id=${load_id}` : ''
      const questionMark = load_id_query || sip_query || rpp_query || page_query ? '?' : ''
      const redirect_Url = `${PATH_MAIN}${questionMark}${sip_query}${rpp_query}${page_query}${load_id_query}`
      
      req.flash('msg', { class: "green", text: `อัปโหลดลายเซ็นสำเร็จ` });
      res.redirect(redirect_Url);
    } catch (err) {
      console.log("Catch Error:", err)
      req.flash('msg', { class: "green", text: `อัปโหลดลายเซ็นสำเร็จ` });
      res.redirect(redirect_Url);
    }
});




export default router






