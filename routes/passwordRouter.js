// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// import * as mySendmail from "../mymodule/mySendmail.js"
// const myData = await import(`../${mymoduleFolder}/myData.js`)
// const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb' ;
import bcrypt from 'bcrypt';
const router = express.Router();
import mainAuth from "../middleware/mainAuth.js" ; 
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const mySendmail = await import(`../${mymoduleFolder}/mySendmail.js`) 
const PATH_MAIN = '/password'
const PATH_RESET = `${PATH_MAIN}/reset`
const PATH_LOGIN = `/login`

//=============================================================
//  หน้าลืม Password
// 
router.get(PATH_MAIN, mainAuth.isLogged, async (req,res) => {
  // console.log(`--------${req.originalUrl}--------`)
  // console.log("req.query ===> " , req.query)

  const client = await MongoClient.connect(global.dbUrl)
  const redirectUrl = `${PATH_MAIN}`
  try {
    //=== สร้างและเข้ารหัสพาสเวิร์ด
    const resetCode = await myModule.generateResetCode()

    //=== ตรวจสอบใน session 
    // - ตรวจสอบแค่เวลาหมดอายุ ของ resetCode
    //   ( ตอนกรอก กรอกเลขตรวจสอบ จะบันทึกลง session ไว้ )
    const now = +new Date() 
    const resetWaitUntil = req.session.resetWaitUntil
    if(resetWaitUntil != null && resetWaitUntil > 0){
      var isValidToFill = now > Number(resetWaitUntil)
    }else{
      var isValidToFill = true
    }    

    const html = await myModule.renderView('passwordForgot', res,{
      title : PAGE_PASSWORD_FORGOT,
      time: myDateTime.getDate() ,
      msg: req.flash('msg'),
      // userFlash: req.flash('userFlash'),
      // ...myUsers.getSessionData(req),

      isValidToFill,
      resetCode ,

      PATH_MAIN ,
      PATH_RESET ,
      PATH_LOGIN,
    })
    res.send(html)
  } catch (error) {   
    console.log("error ===> " , error)
    req.flash('msg', { class : "red", text : error.message })
    return res.redirect(redirectUrl)
  }finally{
    client.close()
  }
})
//=============================================================
// เมื่อกรอกข้อมูล 'ลืมรหัสผ่าน' จะส่งข้อมูลมาที่นี่
// 
router.post(PATH_MAIN, mainAuth.isLogged, async (req,res) => {
  // console.log(`--------${req.originalUrl}--------`)
  // console.log("req.body ===> " , req.body)

  const {inputEmail, resetCodeFill, resetCode} = req.body
  
  //===1.) กำหนดจำนวนครั้งที่อนุญาตให้กรอก (3 ครั้ง) และระยะเวลารอ (5 นาที)
  const MAX_ATTEMPTS = 3;
  const WAIT_MINUTES = 5;
  const now = Date.now();

  //=== 2.) ตรวจสอบ session สำหรับการนับจำนวนครั้งและเวลารอ
  // - resetAttempts: จำนวนครั้งที่กรอกผิด
  // - resetWaitUntil: เวลาที่สามารถกรอกใหม่ได้
  if (!req.session.resetAttempts) {
    req.session.resetAttempts = 0;
    req.session.resetWaitUntil = 0;
  }

  //=== 3.) ถ้ายังอยู่ในช่วงเวลารอ และ จำนวนครั้งที่กรอกยังไม่ถึง MAX_ATTEMPTS
  if (req.session.resetWaitUntil && now < req.session.resetWaitUntil) {
    const waitSeconds = Math.ceil((req.session.resetWaitUntil - now)/1000); 
    req.flash('msg', { 
      class: "red", 
      text: `กรอกผิดเกิน ${MAX_ATTEMPTS} ครั้ง กรุณารอ ${WAIT_MINUTES} นาที (${waitSeconds} วินาที)` 
    });
    return res.redirect(PATH_MAIN);
  }

  //=== 4.) ตรวจสอบการกรอกเลขตรวจสอบ  
  if (resetCodeFill !== resetCode) { //== 4.1) ถ้ากรอกผิด ให้เพิ่มจำนวนครั้ง

    // เพิ่มจำนวนครั้ง
    req.session.resetAttempts += 1;

    //= 4.1.1) ถ้าจำนวนครั้งที่กรอกเกิน MAX_ATTEMPTS ให้ตั้งเวลารอ และรีเซ็ตจำนวนครั้งเป็น 0
    if (req.session.resetAttempts >= MAX_ATTEMPTS) {
      req.session.resetAttempts = 0; // reset attempts after lock
      req.session.resetWaitUntil = now + WAIT_MINUTES * 60 * 1000;
      req.flash('msg', { 
        class: "red", 
        text: `กรอกผิดเกิน ${MAX_ATTEMPTS} ครั้ง{{sep}}กรุณารอ ${WAIT_MINUTES} นาที` 
      });
      return res.redirect(PATH_MAIN);
    }
    //= 4.1.2) ถ้าจำนวนครั้งที่กรอกไม่เกิน MAX_ATTEMPTS - ให้ลองได้อีก
    else {
      req.flash('msg', { 
        class: "red", 
        text: `เลขที่ตรวจสอบไม่ถูกต้อง (${req.session.resetAttempts}/${MAX_ATTEMPTS})` 
      });
      return res.redirect(PATH_MAIN);
    }
  } else { //== 4.2 ถ้ากรอกถูก reset ตัวนับ
    req.session.resetAttempts = 0;
    req.session.resetWaitUntil = 0;
  }

  //=== 5.) ตรวจสอบอีเมล์ที่ส่งมา - ค้นหาว่ามีอยู่ในยูสเซอร์ในระบบหรือไม่
  const client = await MongoClient.connect(global.dbUrl); 
  try {
    const db = client.db(global.dbName)
    const collection = db.collection(global.dbColl_users) 
    const userFind = await collection.findOne(
      { userEmail: inputEmail },
      { projection : { 
          _id: 0,
          // userId : 1,
          userFirstname : 1,
          userLastname : 1,
          userEmail : 1,
        }
      }
    )

    //== 5.1) ถ้าไม่พบยูสเซอร์
    if (!userFind) {
      req.flash('msg', {class:"red",text:`ไม่พบผู้ใช้ "${inputEmail}"`})
      return res.redirect(PATH_MAIN); 
    }

    //== 5.2) สร้าง expire สำหรับลิงค์รีเซ็ตพาสเวิร์ด หมดอายุ 15 นาที
    userFind.expire = myDateTime.getDateTime(15) // 15 นาที

    //== 5.3) เขียนข้อมูล resetpassword ลงฐานข้อมูล
    const coll_userResetPassword = db.collection(global.dbColl_usersResetPassword)
    const insertRtn = await coll_userResetPassword.insertOne(userFind)
    if(insertRtn.acknowledged && insertRtn.insertedId){
      const resetUrl = `${DOMAIN_ALLOW}${PATH_RESET}?id=${insertRtn.insertedId}`

      //= 5.3.1) ต้องดึงข้อมูลการตั้งค่าจากฐานข้อมูล
      const settingsEmail = await myModule.getSettingsSystem_Email()
      if (!settingsEmail || !settingsEmail.EMAIL_WHOSEND || !settingsEmail.EMAIL_PASS) {
        req.flash('msg', { class:"red", text:`ไม่ได้ตั้งค่าการส่งอีเมล์อย่างถูกต้อง`})
        return res.redirect(PATH_MAIN)
      }

      //= 5.3.2) ส่งอีเมล์ลิงค์รีเซ็ตพาสเวิร์ด
      mySendmail
        .sendResetPassword(userFind, resetUrl)
        .then( info => {
            req.flash('msg', { 
              class : "green", 
              text : `ส่งลิงค์รีเซ็ตพาสเวิร์ดไปยัง"(${inputEmail}" เรียบร้อยแล้ว{{sep}}(CODE : ${info.response})` ,
            })
            return res.redirect(PATH_LOGIN)
          }).catch( error => {
            req.flash('msg', {class:"red", text:`${error.message}`})
            return res.redirect(PATH_MAIN)
          })
    }else{
      req.flash('msg', { class:"red", text:`เกิดข้อผิดพลาดขณะสร้างเอกสารรีเซ็ตรหัสผ่าน`})
      return res.redirect(PATH_MAIN)
    }
  } catch (error) {   
    req.flash('msg', { class:"red", text:error.message})
    return res.redirect(PATH_MAIN)
  }finally{
    client.close()
  }
})


/*********************************************************************/
/*********************************************************************/
/*********************************************************************/
/************************** Password Reset ***************************/
/*********************************************************************/
/*********************************************************************/
/*********************************************************************/
/*********************************************************************/




//=============================================================
// หน้า  resetpassword- ใช้กรณียูสเซอร์ลืมพาสเวิร์ด แล้วส่งอิเมล์มาให้รีเซ็ตพาสเวิร์ด 
//
router.get(PATH_RESET, mainAuth.isLogged, async (req,res) => {
  // console.log(`--------${req.originalUrl}--------`)
  // console.log("req.query ===> " , req.query)
  // req.query ===>  { id: '68f85283452bf7e5cd3311da' }
  
  // ตรวจสอบว่า change_id มีค่าหรือไม่
  const change_id = req.query.id  
  if(!change_id){
    return res.status(404).sendFile(file404)
  }

  const client = new MongoClient(global.dbUrl)
  try {    

    //=== 1. ค้นหาเอกสารใน usersResetPassword
    const db = client.db(global.dbName)
    const col_userResetPassword = db.collection(global.dbColl_usersResetPassword)
    const docReset = await col_userResetPassword.findOne({ _id:new ObjectId(change_id) })
    if(!docReset){
      req.flash('msg',{ class: "red", text: `ไม่พบข้อมูลสำหรับรีเซ็ตพาสเวิร์ด` })
      return res.redirect(PATH_LOGIN)
    }

    //=== 2. ตรวจสอบเวลาหมดอายุ
    const currentDateTime = myDateTime.getDateTime(0) // เวลาบัจจุบัน
    let resetRemain = (new Date(docReset.expire) - new Date(currentDateTime))/1000/60/60
    resetRemain = resetRemain < 0 ? 0 : resetRemain
    const isCanReset = resetRemain > 0 ? true : false 
    if(!isCanReset){
      req.flash('msg', {class: "red",text: `ลิงค์รีเซ็ตพาสเวิร์ดหมดอายุ`})
      return res.redirect(PATH_LOGIN)
    }

    //=== 3. โหลดหน้า resetpassword ===
    const html = await myModule.renderView('passwordReset', res ,{
      title : PAGE_PASSWORD_RESET ,
      time: myDateTime.getDateTime(0),
      msg: req.flash('msg'),
      passwordFlash: req.flash('passwordFlash'),      

      PATH_MAIN,
      PATH_LOGIN,
      PATH_RESET,
      
      change_id : change_id ,
      userEmail : docReset.userEmail ,
      newPassword : '',
      confirmPassword : '',
    })
    res.send(html)
  } catch (error) {  
    // console.log("Error ===> " , error.message)
    req.flash('msg', { class : "red", text : error.message})
    return res.redirect(PATH_RESET)
  }finally{
    client.close()
  }
})
//=================================================
//  สำหรับส่งฟอร์มรีเซ็ตพาสเวิร์ด
// 
router.post(PATH_RESET, mainAuth.isLogged, async (req,res) => {  
  // console.log(`--------${req.originalUrl}--------`)
  // console.log("req.body ===> " , req.body)

  const { change_id, userEmail, newPassword, confirmPassword } = req.body

  //=== 
  const redirectUrl = `${PATH_RESET}?id=${change_id}`

  //=== ตรวจสอบความถูกต้องของรหัสผ่าน
  // - ตรวจสอบใน JS อยู่แล้ว ตรวจสอบซ้ำอีกที
  if(newPassword != confirmPassword){
    req.flash('passwordFlash', { newPassword, confirmPassword })
    req.flash('msg', { class : "red",text : `พาสเวิร์ด 2 ช่องไม่ตรงกัน` })
    return res.redirect(redirectUrl)
  }

  const client = await MongoClient.connect(global.dbUrl); 
  try {

    //=== 1.) ค้นหายูสเซอร์ในจาก อีเมล์
    const db = client.db(global.dbName);
    const collection = db.collection(global.dbColl_users);    
    const userFind = await collection.findOne({ userEmail: userEmail });
    if (!userFind) {
      req.flash('passwordFlash', { newPassword, confirmPassword })
      req.flash('msg', { class:"red", text:`ไม่พบผู้ใช้ "${userEmail}"` })
      return res.redirect(PATH_LOGIN)
    }

    //=== 2.) เข้ารหัสพาสเวิร์ดใหม่ - แล้วอัปเดตแทนของเก่า
    const newPassword_Encrypt = await bcrypt.hash(newPassword, global.BCRYPT_NUMBER)
    const updateRtn = await collection.updateOne(
      { userEmail: userEmail },
      { $set: { userPassword: newPassword_Encrypt } }
    )  

    if(updateRtn.matchedCount == 1 && updateRtn.modifiedCount == 0){
      req.flash('passwordFlash', { newPassword, confirmPassword })
      req.flash('msg', { class:"yellow", text:`พาสเวิร์ดเก่ากับใหม่ เป็นตัวเดียวกัน`})
      return res.redirect(redirectUrl)
    }else if(updateRtn.matchedCount == 1 && updateRtn.modifiedCount > 0){
      req.flash('passwordFlash', null)
      req.flash('msg', { class:"green", text:`คุณได้เปลี่ยนรหัสผ่านเรียบร้อยแล้ว`})
      return res.redirect(PATH_LOGIN)
    }else{
      req.flash('passwordFlash', null)
      req.flash('msg', {class:"red", text:`เกิดข้อผิดพลาดขณะเปลี่ยนรหัสผ่านของคุณ`})
      return res.redirect(redirectUrl)
    }
  } catch (error) {   
    req.flash('msg', { class:"red", text:error.message})
    return res.redirect(redirectUrl)
  }finally{
    client.close()
  }
})




export default router




