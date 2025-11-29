
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// import * as mySendmail from "../mymodule/mySendmail.js" 
// import * as myData from "../mymodule/myData.js"  
// import multer from 'multer' ;
// import validator from 'validator' ;
// import XLSX from 'xlsx' ;ss
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb' ;
import bcrypt from 'bcrypt';
const router = express.Router();
import path from 'path' ;
import fs from 'fs'  ;
import ejs from 'ejs'  ;
import mainAuth from "../middleware/mainAuth.js"  ;
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const mySendmail = await import(`../${mymoduleFolder}/mySendmail.js`)
const myData = await import(`../${mymoduleFolder}/myData.js`)
const PATH_MAIN = '/manage/users'
const PATH_SAVE = `${PATH_MAIN}/save`
const PATH_NEW = `${PATH_MAIN}/new`
const PATH_LOAD = `${PATH_MAIN}/load`
const PATH_DELETE = `${PATH_MAIN}/delete`
const PATH_PRINT = `${PATH_MAIN}/print`
const PATH_CHANGES = `${PATH_MAIN}/changes`
const PATH_DOWNLOAD_EXCEL = `${PATH_MAIN}/download-excel`  ;
const PATH_UPLOAD_EXCEL = `${PATH_MAIN}/upload-excel`  ;
const PREFIX = PATH_MAIN.replace(/\//g,"_")
const ADAY_MINUTES = 24*60*60 // 1 วัน ในหน่วยนาที

//=======================================================
// หน้าแรก user
// 
// http://localhost/manage/users?sip=&rpp=20&page=1&load_id=689eb7d54ea43b1123cb847e
// 
router.get(PATH_MAIN, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)
  // req.query ===>  { sip: '', rpp: '20', page: '1', load_id: '689eb7d54ea43b1123cb847e' }
  // ถ้าไม่มี LoadId
  

  //=== คำค้นหา - การแบ่งหน้า
  const sip = req.query.sip
  const rpp = Number(req.query.rpp) || 20
  const page = Number(req.query.page) || 1
  const load_id = req.query.load_id || '' // เป็น _id 
  const skipDocs = Number((page - 1) * rpp)
  //=== วันปัจจุบัน
  const nowLocal = myDateTime.getDateTime(0) // '2024-06-10 14:30'
  
  const client = new MongoClient(dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_users = db.collection(global.dbColl_users)

    //== 1) มีคำค้นหา sip

    //== 1.1) มีคำค้นหา - นับจำนวนเอกสาร
    if (sip) {
      const regex = new RegExp(sip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
      let userId_Query = {};
      if (!isNaN(Number(sip))) {
        userId_Query = { userId: Number(sip) };
      } else {
        userId_Query = { userId: { $regex: regex } };
      }

      var totalDocs = await coll_users.countDocuments({
        $or: [
          userId_Query ,
          { username: { $regex: regex } },
          { userFirstname: { $regex: regex } },
        ]
      })
    } else { // ไม่มีคำค้นหา
      var totalDocs = await coll_users.countDocuments({})
    }
    const pageNum = Math.ceil(totalDocs / rpp)
    const pagePre = Number(page) - 1 < 1 ? "-" : Number(page) - 1
    const pageAct = Number(page)
    const pageNxt = Number(page) + 1 > pageNum ? "-" : Number(page) + 1

    const agg = [
      {
        $project: {
          _id: 1,
          userIsActive: 1,
          userId: 1,
          username: 1,
          userFullname: { $concat: ["$userPrefix", " ", "$userFirstname", " ", "$userLastname"] },
          // userEmail: 1 ,
          userAuthority: 1,
          canDelete: 1,
          changesHistoryCount: { $size: { $ifNull: ["$changesHistory", []] } },
          isCanDelete: {
            $cond: {
              if: {
                $gt: [
                  {
                    $dateDiff: {
                      startDate: { $toDate: nowLocal },
                      endDate: { $toDate: "$dateTimeCanDelete" },
                      unit: "minute"
                    }
                  },
                  0
                ]
              },
              then: true,
              else: false
            }
          },
        }
      },
      // { $sort: { userId : 1 } } ,
      { $sort: { userId: -1 } }, // V12 - เรียงจากใหม่ไปเก่า 
      { $skip: skipDocs },
      { $limit: rpp },
    ]

    //== 1.2) มีคำค้นหา - ค้นหาเอกสารตาม sip 
    if (sip) {
      const regex = sip ? new RegExp(`${sip}`, "i") : new RegExp(`.*`);
      let userId_Query = {};
      if (!isNaN(Number(sip))) {
        userId_Query = { userId: Number(sip) };
      } else {
        userId_Query = { userId: { $regex: regex } };
      }
      agg.unshift(
        {
          $match: {
            $or: [
              userId_Query,
              { username: { $regex: regex } },
              { userFirstname: { $regex: regex } },
            ],
          }
        },
      )
    }


    //== 1.3) ถ้าเป็น A กรอง O ออก รวมถึงกรอก A คนอื่นๆออกเอาตัวเองไว้
    // - A มีสิทธิจัดการผู้ใช้ได้ แต่ U จะไม่เห็น O/A
    const user_current = myUsers.getSessionData(req)
    const userAuthority_current = user_current.userAuthority
    let dataUser = await coll_users.aggregate(agg).toArray()
    if (['A'].includes(userAuthority_current)) {
      const userId_current = user_current.userId
      dataUser = dataUser.filter(item => {
        const is_MeS_NotOtherS = item.userAuthority !== 'A' || item.userId == userId_current
        return item.userAuthority !== 'O' && is_MeS_NotOtherS
      })
    }

    //=== 2.1) ถ้ามี load_id ส่งมา - ให้ค้นหายูสเซอร์ที่จะโหลดลงฟอร์ม
    if (load_id) {
      var userToLoad = await coll_users.findOne(
        { _id: new ObjectId(load_id) },
        { projection: { userPassword: 0 } }
      )
    } else {
      var userToLoad = {}
    }

    //=== 2.2) ตรวจสอบว่า userToLoad เป็นอ็อบเจ็กต์ว่าง {}
    // - ถ้าว่าง ให้เอาค่าจาก req.flash('userFlash') ถ้ามี
    //   ซึ่งจะมีมาหากในขั้นตอน save เกิด Error
    if (userToLoad && Object.keys(userToLoad).length === 0) {
      const userFlash = req.flash('userFlash') // flash เป็นอาเรย์
      if (userFlash && userFlash.length > 0) {
        userToLoad = {...userFlash[0]} || null;
      }
    }

    //=== 3) Render
    const html = await myModule.renderView("manageUsers", res, {
      title: PAGE_MANAGE_USERS,
      time: myDateTime.getDate() ,
      msg: req.flash('msg'),
      user : myUsers.getSessionData(req),
      settings : await myModule.getSettings(),

      //=== สำหรับ คำค้นหา
      load_id: load_id, // ส่งมาจากการ load หรือการ save 
      sip: sip,
      //=== สำหรับ pagination
      rpp: rpp,
      page: page,
      pagePre: pagePre,
      pageAct: pageAct,
      pageNxt: pageNxt,
      pageLst: pageNum,
      pageRedirect: PATH_MAIN,
      // 
      data: dataUser,
      //===
      PATH_MAIN,
      PATH_PRINT, 
      PATH_SAVE,
      PATH_NEW,
      PATH_LOAD,
      PATH_DELETE,
      PATH_CHANGES,
      PATH_DOWNLOAD_EXCEL,
      PATH_UPLOAD_EXCEL,
      PREFIX,
      USER_AUTHORITIES_JSON : JSON.stringify(global.USER_AUTHORITIES),

      //=== ใช้คำว่า item แทน user เผื่อจะได้ใช้ซ้ำกับอื่นๆได้
      item: userToLoad,
    })
    return res.send(html)
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})



//=============================================
//
router.post(PATH_LOAD, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)

  const load_id = req.body.load_id // _id 
  const sip = req.body.sip
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${load_id}`

  const client = new MongoClient(dbUrl)
  try{
    const db = client.db(dbName);
    const collection = db.collection(dbColl_users)

    // const rtn = await collection.findOne({ userId:load_id })
    // const rtn = await collection.findOne({ userId:load_id })
    const rtn = await collection.findOne(
      { _id: new ObjectId(load_id) },
      { projection: { changesHistory : 0 } } // กำหนดฟิลด์ที่ต้องการดึงมาแสดงในฟอร์ม
    )
    if( rtn ){
      req.flash('msg', null)
    }else{  
      req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${load_id}"` })
    }
    return res.redirect(redirectUrl)
  }catch(err){
    console.log(err.message)
    req.flash('msg', { class:"red", text:`${err.message}` })
    return res.redirect(redirectUrl)
  }finally{
    client.close()
  }
})


//=======================================================
// ใช้กับทั้ง Create และ Update
router.post(PATH_SAVE, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  //=== เปิดหัว Que
  const queueArr = []
  let processingQue = false
  const processQueueFunc = async () => {
    if (queueArr.length === 0) {
      processingQue = false
      return
    }
    processingQue = true
    const {req,res} = queueArr.shift()
    await handleRequest(req, res)
    processQueueFunc()
  }

  //===
  const handleRequest = async (req, res) => {

    //=== 1.) ค่าจาก req.body
    const _id = req.body._id
    delete req.body._id  // ต้องลบออกด้วยไม่เช่นนั้นจะ error เพราะแก้ไข _id ไม่ได้
    const sip = req.body.sip
    const rpp = Number(req.body.rpp) || 20
    const page = Number(req.body.page) || 1  
    delete req.body.rpp  // ลบออกด้วยไม่เช่นนั้นจะลงฐานข้อมูลด้วย
    delete req.body.sip  // ลบออกด้วยไม่เช่นนั้นจะลงฐานข้อมูลด้วย
    delete req.body.page // ลบออกด้วยไม่เช่นนั้นจะลงฐานข้อมูลด้วย

    // เปลี่ยนชนิดข้อมูลเป็นตัวเลข *** 
    req.body.userId = req.body.userId ? Number(req.body.userId) : req.body.userId
    const username = req.body.username?.trim()   // ห้ามซ้ำ - อาจไม่มีถ้าเป็น New
    const userEmail = req.body.userEmail?.trim() // ห้ามซ้ำ - อาจไม่มีถ้าเป็น New
    const userId = req.body.userId               // ห้ามซ้ำ - อาจไม่มีถ้าเป็น New

    //=== 2.) URL สำหรับการ Redirect
    const redirectUrl_error = `${PATH_MAIN}`
    const redirectUrl_update = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${_id}`

    //=== 3.) ตรวจสอบรูปแบบของ username
    const usernameRegex = new RegExp(global.USERNAME_PATTERN)
    if (!usernameRegex.test(username)) {
      req.flash('userFlash', req.body )
      req.flash('msg', {class:"red", text: global.USERNAME_DESCRIPTION})
      return res.redirect(redirectUrl_update)
    }

    //=== 4.) ตรวจสอบรูปแบบของ email
    if(userEmail){
      const emailRegex = new RegExp(global.EMAIL_PATTERN)
      if (!emailRegex.test(userEmail)) {
        req.flash('userFlash', req.body )
        req.flash('msg', { class:"red", text:`รูปแบบอีเมลไม่ถูกต้อง` })
        return res.redirect(redirectUrl_update)
      }
    }

    const client = new MongoClient(dbUrl)
    try {
      await client.connect()
      const db = client.db(dbName)
      const coll_users = db.collection(dbColl_users)

      //=== ถ้าไม่มี _id ส่งมาด้วย *** เป็นกรณี New User (สร้างใหม่)
      // ตรวจสอบว่ามี email/username/userId ที่ส่งมา ซ้ำกับยูสซอร์อื่นๆหรือไม่

      //=== 1.) สร้าง user ใหม่ - ตรวจสอบการซ้ำ
      if (!_id) {

        //== 1.1) ตรวจสอบการซ้ำ - ค้นหา user อื่นๆ userEmail/username (เปลี่ยนได้ แต่ห้ามซ้ำ)
        const userFind = await coll_users.findOne({
          // _id: { $ne: new ObjectId(_id) } , // ไม่มี _id เพราะเป็นการสร้างใหม่
          $or: [
            { userEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
            { username: { $regex: new RegExp(`^${username}$`, 'i') } },
            // { userId:userId } ,  // userId สร้างใหม่ ไม่ต้องตรวจสอบ
          ]
        })
        //== ถ้ามี userFind
        if (userFind) {
          req.flash('userFlash', req.body )
          req.flash('msg', { class: "red", text: `อีเมลหรือชื่อผู้ใช้{{sep}}มีอยู่ในระบบแล้ว` })
          return res.redirect(redirectUrl_update)
        }

        //== 1.2) คำนวณ ID ใหม่หากไม่มี _id ติดมาด้วย *** เป็นกรณี New User (สร้างใหม่)
        // - เลข 6 หลัก ดูจาก padStart(6, '0')
        // คำนวณ userId ใหม่
        const maxId = await coll_users.find(
          {},
          { projection : { userId:1 } }
        ).sort({userId:-1}).limit(1).toArray()
        const fstId = 1000   // เริ่มต้นที่ 1000
        const newId = maxId.length > 0 ? (maxId[0].userId + 1) : fstId
        req.body.userId = newId
        
        //== 1.3) Stamp วันเวลาสำหรับแก้ไข เฉพาะ new เท่านั้น (1 วัน)
        req.body.dateTimeCanDelete = myDateTime.getDateTime(1440) // 1 วัน = 1440 นาที
      
        //== 1.4) สร้างและเข้ารหัสพาสเวิร์ด
        const userPassword_pure = myModule.generatePassword()
        req.body.userPassword = await bcrypt.hash(userPassword_pure, global.BCRYPT_NUMBER)

        //== 1.5) สร้าง User ใหม่ - บันทึกลงฐานข้อมูล
        const rtnInsert = await coll_users.insertOne(req.body)
        
        //== 1.6) ส่งเมล์ต่อ - เมื่อสร้าง User สำเร็จ
        if(rtnInsert.acknowledged && rtnInsert.insertedId){
          const new_user_id = rtnInsert.insertedId.toString()
          const redirectUrl_new = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}&load_id=${new_user_id}`

          // สำหรับส่งเมล์
          const flashObj = {...req.body}
          delete flashObj.userPassword

          //= 3.3.1) ส่งเมล์ถ้ามี email ถูกต้อง
          if(userEmail.includes('@') && userEmail.includes('.') && userEmail.length > 5){
            
            //= 3.3.1-1) ต้องดึงข้อมูลการตั้งค่าจากฐานข้อมูล
            const settingsEmail = await myModule.getSettingsSystem_Email()
            if (!settingsEmail || !settingsEmail.EMAIL_WHOSEND || !settingsEmail.EMAIL_PASS) {
              req.flash('msg', { class:"yellow", text:`สร้างยูสเซอร์ ${newId} แล้ว{{sep}}แต่ไม่ได้ส่งอีเมล์ การตั้งค่าการส่งอิเมล์ไม่ถูกต้อง`})
              return res.redirect(redirectUrl_new)
            }

            //= 3.3.1-2) ส่งอีเมล์แจ้งรหัสผ่านไปยัง user
            mySendmail.sendRegisterUserEmail(flashObj, userPassword_pure)
              .then( info => { 
                req.flash('msg', {
                  class: "green",
                  text: `เพิ่มยูสเซอร์และส่งอิเมล์เรียบร้อยแล้ว (${userEmail}){{sep}}(CODE : ${info.response})`
                })
                return res.redirect(redirectUrl_new)
              }).catch(error => {
                req.flash('userFlash', req.body )
                req.flash('msg', { class:"red",text:`${error.message}` })
                return res.redirect(redirectUrl_new)
              })
          }else{ // ไม่มี email
            req.flash('userFlash', req.body )
            req.flash('msg', { class: "green", text: `เพิ่มยูสเซอร์ ${userEmail}` })
            return res.redirect(redirectUrl_new)
          }
        }else{
          req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะเพิ่ม/ส่งอีเมลไปยังผู้ใช้ใหม่` })
          res.redirect(redirectUrl_error)
        }
      }
      
      //=== 2.) กรณี Update - ******************************      
      else{  

        //== 2.1) ค้นหาการซ้ำกับผู้ใช้อื่น - แต่ไม่รวมตัวเอง
        // - ค้นหา user ตาม  email/username/userId (เปลี่ยนได้ แต่ห้ามซ้ำ)
        // - ถ้ามี userOtherFind = ซ้ำ
        var userOtherFind = await coll_users.findOne({
          _id: { $ne: new ObjectId(_id) } ,  // ไม่เอาตัวเอง
          $or: [
            { userEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
            { username: { $regex: new RegExp(`^${username}$`, 'i') } },
            { userId: userId },
          ]
        })        
        if (userOtherFind) {
          req.flash('userFlash', req.body )
          req.flash('msg', { class: "red", text: `อีเมล/ชื่อผู้ใช้{{sep}}มีอยู่ในระบบแล้ว` })
          return res.redirect(redirectUrl_update)
        }

        //== 2.2) ถ้าเปลี่ยนฟิลด์ที่มีผลต่อไปนี้ ให้ลบ session ทั้งหมดของ user เพื่อบังคับให้ user นั้น logout แล้ว login ใหม่
        // - ให้ลบ session ทั้งหมดของ user
        // - ตรวจสอบของเดิมก่อนแก้ไข กับ req.body ที่ส่งมา ถ้าไม่เหมือนกันจะเป็น false
        //   *** ต้องทำใน userInfo ด้วย ****  
        const user_before = await coll_users.findOne({ _id: new ObjectId(_id) })
        const isSameArr = [
          req.body.userIsActive == 'active' ,            // active ไม่ต้องลบ session
          user_before.username == req.body.username ,   // แก้ชื่อผู้ใช้
          user_before.userEmail == req.body.userEmail , // เปลี่ยนอีเมล
          user_before.userAuthority == req.body.userAuthority , // เปลี่ยนสิทธิ
        ]
        // console.log("isSameArr ===> ", isSameArr)

        //== 2.3) ถ้าเป็น Inactive หรือ เปลี่ยน userAuthority
        const updateQuery = { $set: req.body }
        const rtnUpdate = await coll_users.updateOne(
          { _id: new ObjectId(_id) },
          updateQuery,
          { upsert: false }
        )

        //== 2.4) Return on Update
        if (rtnUpdate.acknowledged && rtnUpdate.modifiedCount == 1) {

          const user_inSession = myUsers.getSessionData(req)
          let msg = `อัปเดท "${userId}" เรียบร้อยแล้ว`

          //= 2.5.1) เก็บ changes
          const changes = myData.getChangeHistory(user_before, req.body);
          if (changes && changes.length > 0) {
            const changeHistoryObj = {
              dateTime : myDateTime.getDateTime() ,
              userId : user_inSession.userId ,
              userFullname : user_inSession.userFullname ,
              changes : changes,
            }
            //= Update History - เพิ่มข้อมูลการอัปเดท
            await coll_users.updateOne(
              { userId: userId }, // ไว้ตำแหน่งแรก - แก้ไขที่หลังอยู่บนสุด 
              { $push: { changesHistory: { $each: [changeHistoryObj], $position: 0 } } }
            ) 
            msg += `{{sep}}[ บันทึกการแก้ไข ]`
          }

          //= 2.5.2) ลบ session ทั้งหมดของ user ที่ถูกแก้ไข - มี false อย่างน้อย 1 ตัว
          if( isSameArr.includes(false) ){
            const coll_sessions = db.collection(global.dbColl_sessions)
            const deleteResult = await coll_sessions.deleteMany({"session.user_id":_id })
            if(deleteResult.acknowledged && deleteResult.deletedCount > 0){
              msg += `{{sep}}( ลบเซสชั่นทั้งหมดจำนวน  "${deleteResult.deletedCount}" เรียบร้อยแล้ว )`
            }else{  
              msg += `{{sep}}( ไม่พบเซสชั่น )`
            }
          }
          //= 2.5.3) ถ้า user แก้ไขข้อมูลตัวเอง ที่สำคัญ ให้ logout ทันที ****
          if(isSameArr.includes(false) && user_inSession.user_id == _id ){
            req.session.destroy( (err) => {
              if(err) console.log("Session destroy error: ", err);              
              return res.redirect('/')
            })
            return // ป้องกันการทำงานต่อ
          }else{
            req.flash('msg', { class: "green", text:msg })
            return res.redirect(redirectUrl_update)
          }
        } else if (rtnUpdate.acknowledged && (rtnUpdate.modifiedCount < 1 || rtnUpdate.upsertedCount < 1)) {
          req.flash('msg', { class: "yellow", text: `"${userId}" ไม่มีอะไรเปลี่ยนแปลง`})
          return res.redirect(redirectUrl_update)
        } else {
          req.flash('userFlash', req.body )
          req.flash('msg', { class: "red", text: `${new Error("Not Found")}{{sep}}"${userId}"` })
          return res.redirect(redirectUrl_update)
        }
      }
    } catch (err) {
      console.log("error ===> ", err);
      res.status(404).sendFile(file404)
    } finally {
      client.close()
    }
  }

  //=== ปิดท้าย - ทำตรงนี้ก่อน
  // - ถ้ามี req - ใส่ลงใน queueArr แล้วไปตรวจสอบ que
  queueArr.push({req,res})
  //=== ถ้าไม่มี Que ให้รันฟังก์ชั่น processQueueFunc() 
  if (!processingQue) {
    processQueueFunc() 
  }
})

//=======================================================
// สร้าง user ใหม่ทันที - ไม่ต้องส่งอิเมล์
// 
router.post(PATH_NEW, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  const client = new MongoClient(dbUrl)
  const redirect_error = `${PATH_MAIN}`    
  try {
    await client.connect()
    const db = client.db(dbName)
    const coll_users = db.collection(dbColl_users)

    //=== จับ userId สุดท้ายใน collection users
    var lastUser = await coll_users.find({}).sort({userId:-1}).limit(1).toArray()
    var newId = 0
    if( lastUser.length > 0 ) { 
      newId = lastUser[0].userId + 1
    }else{
      return res.send({
        isCreate: false ,
        msg: 'ยังไม่มีผู้ใช้ในระบบเลย ต้องเพิ่มผู้ใช้หลักก่อน',
        redirectUrl: redirect_error
      })
    }

    const START_PASSWORD = process.env.START_PASSWORD || 'qwerty'
    const users_toAdd = {
      userId: newId ,
      userEmail: `user_${newId}@gmail.com`,
      username: `user_${newId}`,
      userPrefix: '',
      userFirstname: `user_${newId}`,
      userLastname: ``,
      userAuthority: 'U',
      userIsActive: 'active',
      userPassword: await bcrypt.hash(START_PASSWORD, global.BCRYPT_NUMBER),
      dateTimeCanDelete: myDateTime.getDateTime(ADAY_MINUTES),
    }
    
    const rtn = await coll_users.insertOne(users_toAdd)
    if( rtn.acknowledged && rtn.insertedId ){
      return res.send({
        isCreate: true ,
        msg: `สร้างผู้ใช้ใหม่ "${users_toAdd.username}" เรียบร้อยแล้ว{{sep}}( รหัสผ่านเริ่มต้น "${START_PASSWORD}" )` ,
        redirectUrl: `${PATH_MAIN}?rpp=20&page=1&load_id=${rtn.insertedId.toString()}`
      })
    }else{
      return res.send({
        isCreate: false ,
        msg: `เกิดข้อผิดพลาดขณะเพิ่มผู้ใช้ใหม่` ,
        redirectUrl: redirect_error
      })
    }
  } catch (err) {
    console.log("error ===> ", err);
    res.status(404).sendFile(redirect_error)
  } finally {
    client.close()
  }
})


//=============================================
// 
router.post(PATH_DELETE, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)

  let { _id_toDelete, load_id, sip, Id_toDelete } = req.body
  const rpp = Number(req.body.rpp) || 20
  const page = Number(req.body.page) || 1 
  Id_toDelete = Number(Id_toDelete) // ตัวเลขเท่านั้น

  //=== ตรวจสอบ load_id ที่ส่งมา
  // เมื่อมี load_id ส่งมา ต้องไม่ใช่ตัวที่จะลบ - ถ้าเป็นตัวที่จะลบ จะไม่มีการโหลดอีกเมื่อ redirect
  const load_id_query =  _id_toDelete && _id_toDelete != load_id ? `&load_id=${_id_toDelete}` : ''
  const redirectUrl = `${PATH_MAIN}?sip=${sip}&rpp=${rpp}&page=${page}${load_id_query}`

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const coll_users = db.collection(global.dbColl_users)

    //=== 1.) ตรวจสอบ user ที่จะลบ *** ต้องไม่มีในเอกสารใดๆ ***
    const collections = [
      { coll: db.collection(global.dbColl_docs),    // 1
        name: global.dbColl_docs, 
        key: 'userId' }, // ชื่อคีย์ในเอกสาร ที่ใช้ userId
      // { coll: db.collection(global.dbColl_warehouseOut),   // 2
      //   name: global.dbColl_warehouseOut, 
      //   key: 'userId' }, 
      // { coll: db.collection(global.dbColl_sales),       // 3
      //   name: global.dbColl_sales, 
      //   key: 'userId' }, 
      // { coll: db.collection(global.dbColl_return),       // 4
      //   name: global.dbColl_return, 
      //   key: 'userId' }, 
    ];
    // ตรวจสอบทุก collection พร้อมกัน ****
    for (const { coll, name, key } of collections) {
      //== ค้นหาในแต่ละเอกสาร
      const query = {};
      query[key] = Id_toDelete;
      const docFind = await coll.findOne(query);

      //== ถ้าพบ Stamp ในคอลเล็กชั่น users ว่าลบไม่ได้ - เอาไปใช้ตอนสร้าง Table
      // - ถ้าไม่พบในเอกสารใดๆเลย ให้ลบได้
      if (docFind) {
        await coll_users.updateOne(
          { userId: Id_toDelete }, 
          { $set: { canDelete: false } }
        );
        req.flash('msg', { 
          class: "red", 
          text: `ยูสเซอร์ "${Id_toDelete}" มีอยู่ในเอกสาร ${name}{{sep}}ไม่สามารถลบได้` 
        });
        return res.redirect(redirectUrl);
      }
    }

    //=== 2.) ลบ User - ถ้าในคอลเล็กชั่นเอกสารทั้งหมดไม่มี
    const deleteResult = await coll_users.deleteOne({ _id: new ObjectId(_id_toDelete) })
    if (deleteResult.deletedCount === 1) {

      //== 2.1) ลบ session ทั้งหมดของ user ที่ถูกลบ
      const coll_sessions = db.collection(global.dbColl_sessions)
      const deleteSessionResult = await coll_sessions.deleteMany({"session.user_id":_id_toDelete })
      if(deleteSessionResult.acknowledged && deleteSessionResult.deletedCount > 0){
        var afterMsg = `{{sep}}( ลบเซสชั่นทั้งหมดจำนวน  "${deleteSessionResult.deletedCount}" เรียบร้อยแล้ว )`
      }else{  
        var afterMsg = `{{sep}}( ไม่พบเซสชั่น )`
      }

      //== 2.2) Return
      req.flash('msg', { class:"green", text:`ลบยูสเซอร์ "${Id_toDelete}" เรียบร้อยแล้ว${afterMsg}` })
    } else {
      req.flash('msg', { class:"red", text: `ไม่พบ "${Id_toDelete}"{{sep}}( อาจจะถูกลบไปแล้ว )` })
    }
    return res.redirect(redirectUrl)
  } catch (err) {
    console.log("error ===> ", err);
    req.flash('msg', { class:"red", text: err.message})  
    return res.redirect(redirectUrl)
  } finally {
    client.close();
  } 
})




//=============================================
// 
router.post(PATH_PRINT, mainAuth.isOA, async (req, res) => {  
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.body ===> " , req.body)

  const { _idArr } = req.body
  const client = new MongoClient(dbUrl)
  try {
    await client.connect()
    const db = client.db(dbName)
    const collection = db.collection(dbColl_users)

    const usersFind = await collection.aggregate([
      { 
        $match: { 
          _id: { 
            $in: _idArr.map(id => new ObjectId(id)) 
          } 
        } 
      },
      // // Lookup branchName from userBranches
      // {
      //   $lookup: {
      //     from: global.dbColl_userBranches,
      //     localField: 'branchId',
      //     foreignField: 'branchId',
      //     as: 'branchInfo'
      //   }
      // },
      // {
      //   $addFields: {
      //     branchName: {
      //       $ifNull: [ { $arrayElemAt: ['$branchInfo.branchName', 0] }, '' ]
      //     }
      //   }
      // },
      { $project: { branchInfo: 0 } }
    ]).toArray();

    if(usersFind.length == 0){
      return res.send(JSON.stringify({
        isPrint : false,
        class : "red",
        msg: `ไม่มีข้อมูล` , 
      }))
    }

    //=== สร้างฟอร์มจาก HTML
    const templatePath = path.join(global.folderForms, 'print_users.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8'); 
    const htmlPage = ejs.render(templateContent, {
      time : myDateTime.getDate() ,
      title : `ยูสเซอร์ (${usersFind.length})`,
      dateTime :  myDateTime.getDateTime() ,
      usersFind : usersFind,
    })

    res.send(JSON.stringify({      
      isPrint : true,
      class : "green",
      msg: `พิมพ์ข้อมูล ${usersFind.length} ยูสเซอร์เรียบร้อยแล้ว` ,
      htmlPage : htmlPage ,      
    }))

  } catch (err) {
    console.log("error ===> ", err.message);
    res.send(JSON.stringify({
      isPrint : false,
      class : "red",
      msg: err.message , 
    }))
  } finally {
    client.close();
  } 
})




//=============================================
// 
router.post(PATH_CHANGES, mainAuth.isOA, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> ", req.body)

  //=== 0.1) จับประเภทเอกสาร
  let { userId } = req.body
  userId = Number(userId) // ตัวเลขเท่านั้น

  const client = new MongoClient(global.dbUrl)
  try {
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_users)

    //=== 1.) ค้นหาเอกสาร (ถ้ามี docId)
    var userFind = await collection.findOne({ userId : userId })
    if(!userFind){
      return res.send(JSON.stringify({
        isPrint: false ,
        class:"red", 
        msg:`ไม่พบ "${userId}"`
      }))
    }
    // console.log("docFind ===> ", docFind)

    //=== 2.) จับเฉพาะค่า changesHistory จาก docFind
    const changesHistory = userFind.changesHistory || []

    //=== 3.) ตรวจสอบประวัติการเปลี่ยนแปลง
    if(changesHistory.length < 1){
      return res.send(JSON.stringify({
        isPrint: false ,
        class:"yellow", 
        msg:`ไม่พบประวัติการเปลี่ยนแปลง`
      }))
    }

    //=== 3.) สร้าง HTML จาก template
    const templatePath = path.join(folderForms, 'changes_tableRows.ejs')
    const htmlPage =  await myModule.renderView(templatePath, res, {
      title: `ประวัติการแก้ไขยูสเซอร์ : [${userFind.userId}] ${userFind.userPrefix} ${userFind.userFirstname} ${userFind.userLastname}`,
      time: myDateTime.getDateTime(), 
      changesHistory : changesHistory,
    });

    //=== 4.) ส่ง HTML กลับไป
    res.send(JSON.stringify({
      isPrint:true,
      class:"green",
      htmlPage:htmlPage
    }))
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({ isPrint:false, class:"red", msg:err.message}))
  } finally {
    client.close();
  } 
})



export default router




