import express from 'express'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
const router = express.Router()
const PATH_ROOT = '/'
const PATH_ADD_WASAN = `${PATH_ROOT}add-wasan`
const PATH_ADD_TEST = `${PATH_ROOT}add-test`
const PATH_LOGIN = `${PATH_ROOT}login`
const PATH_SETTINGS = `${PATH_ROOT}add-settings`
const PATH_SETTINGS_SYSTEM = `${PATH_ROOT}add-settings-system`

//=======================================================
// สำหรับเพิ่มยูสเซอร์ WASAN สำหรับการใช้งานครั้งแรก
// 
router.get([ PATH_ADD_WASAN, PATH_ADD_TEST ], async (req, res) => {
  console.log(`-----------------${req.originalUrl}----------------------`)
  console.log(`-----------------${req.path}----------------------`)
  // console.log("req.query ===> " , req.query)

  let  { key} = req.query
  if (key !== 'wasan123') {
    req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
    return res.redirect(PATH_LOGIN)
  }

  if(req.path === PATH_ADD_WASAN) {
    var userToAdd = {
      userId : 1000,
      userEmail : 'wasankds@gmail.com'  ,
      username : 'wasankds',
      userPrefix: 'นาย' ,
      userFirstname: 'Wasan' ,
      userLastname: 'Khunnadiloksawet' ,
      userAuthority: 'O' ,
      userIsActive: 'active',
      userPassword: await bcrypt.hash('qwerty', 12),
      branchId: 100,
    }
  }else if(req.path === PATH_ADD_TEST) {
    var userToAdd = {
      userId : 1001,
      userEmail : 'admin-test@gmail.com'  ,
      username : 'admin-test',
      userPrefix: 'Mr' ,
      userFirstname: 'Admin' ,
      userLastname: 'Test' ,
      userAuthority: 'A' ,
      userIsActive: 'active',
      userPassword: await bcrypt.hash('qwerty', 12),
      branchId: 100,
    }
  }
  console.log(userToAdd)

  const client = new MongoClient(dbUrl)
  try {
    const db = client.db(dbName);
    const coll_users = db.collection(dbColl_users)

    // ตรวจสอบว่ามีผู้ใช้ WASAN อยู่แล้วหรือไม่
    var userFind = await coll_users.findOne({
      $or: [
        { userId:userToAdd.userId } ,
        { username:userToAdd.username } ,
        { userEmail:userToAdd.userEmail }
      ]
    })

    // มีผู้ใช้ WASAN อยู่แล้ว - ไม่ต้องเพิ่ม
    if( userFind ) {
      req.flash('msg', { class:"red", text:`ผู้ใช้ ${userFind.username} มีอยู่แล้ว` })
      res.redirect(PATH_LOGIN)
      return
    }

    // ไม่มีผู้ใช้ WASAN อยู่ - ให้เพิ่มยูสเซอร์ WASAN ลงในฐานข้อมูล
    const rtn = await coll_users.insertOne({
      userId: userToAdd.userId ,
      username: userToAdd.username ,
      userEmail: userToAdd.userEmail ,
      userPrefix: userToAdd.userPrefix ,
      userFirstname: userToAdd.userFirstname ,
      userLastname: userToAdd.userLastname ,
      userAuthority: userToAdd.userAuthority ,
      userIsActive: userToAdd.userIsActive ,
      userPassword: userToAdd.userPassword ,
      branchId: userToAdd.branchId ,
    })    


    // //=== เซ็ตการตั้งค่าระบบ
    // const coll_settings = db.collection(dbColl_settings)
    // await coll_settings.deleteMany({})
    // await coll_settings.insertOne({
    //   "COMPANY_NAME": `${global.SYS_NAME} ${global.SYS_NAME2}`.trim() ,
    //   // "NOTE_TEXT": "Report Note - บันทึกอะไรก็ได้ ",
    //   // "FILES_MANAGER": "on",
    //   // "SYSTEM_SETTINGS": "on",
    //   // "MOUSE_ACTION": "on",
    //   // "TERM_AND_CONDITION": "on",
    //   // "SYSTEM_MANUAL": "on"
    // })
    if (rtn.acknowledged) {
      req.flash('msg', { class:"green", text:`เพิ่มผู้ใช้ ${userToAdd.username} สำเร็จ` })
      res.redirect(PATH_LOGIN)
    } else {
      req.flash('msg', { class:"red",  text:`เพิ่มผู้ใช้ ${userToAdd.username} ไม่สำเร็จ` })
      res.redirect(PATH_LOGIN)
    }
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})

//=======================================================
// สำหรับเขียน Setting ลงฐานข้อมูล
// 
router.get(PATH_SETTINGS, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)

  let  { key} = req.query
  if (key !== 'wasan123') {
    req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
    return res.redirect(PATH_LOGIN)
  }

  const client = new MongoClient(dbUrl)
  try {
    //=== เขียนลงฐานข้อมูล
    await client.connect()
    const db = client.db(dbName);
    const collection = db.collection(dbColl_settings)
    await collection.deleteMany({})
    const rtn = await collection.insertOne({
      // RECAPTCHA_SITE_KEY : "",
      // RECAPTCHA_SECRET_KEY : "",
      // TELEGRAM_NOTIFY : "off",
      // TELEGRAM_BOT_TOKEN : "",
      // TELEGRAM_GROUP_CHAT_ID : "",
      // TELEGRAM_COMMENT : "",

      // ITEM_TYPE : "เครื่องมือ,เครื่องจักร",
      // ITEM_STATUS : "ปกติ,เบิก,ชำรุด,สูญหาย,จำหน่ายซาก,ประจำสถานี,ส่งซ่อม",

      // TITLE_1 : "บริษัท ตัวอย่าง จำกัด", // ชื่อบริษัทในฟอร์ม
      // TITLE_2 : "ใบเบิก/คืนอุปกรณ์",  // ชื่อเอกสารในฟอร์ม
    }) 

    if (rtn.acknowledged) {
      req.flash('msg', { class:"green", text:'ตั้งค่าเริ่มต้นของระบบ สำเร็จ' })
      res.redirect(PATH_LOGIN)
    } else {
      req.flash('msg', { class:"red", text:'ตั้งค่าเริ่มต้นของระบบ ไม่สำเร็จ !!!' })
      res.redirect(PATH_LOGIN)
    }
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})



//=======================================================
// สำหรับเขียน SystemSetting ลงฐานข้อมูล
// 
router.get(PATH_SETTINGS_SYSTEM, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)

  let  { key} = req.query
  if (key !== 'wasan123') {
    req.flash('msg', { class:"red", text:'Key ไม่ถูกต้อง' })
    return res.redirect(PATH_LOGIN)
  }

  const client = new MongoClient(dbUrl)
  try {
    //=== เขียนลงฐานข้อมูล
    await client.connect()
    const db = client.db(dbName);
    const collection = db.collection(dbColl_settingsSystem)
    await collection.deleteMany({})
    const rtn = await collection.insertOne({
      // RECAPTCHA_SITE_KEY : "",
      // RECAPTCHA_SECRET_KEY : "",
      DEPLOY : "1",
      PORT_SERVER : "80",
      PORT_DEV : "8080",
      LOCALHOST_ALLOW : "http://localhost",
      DOMAIN_ALLOW : "http://wasankds.com",
    }) 
    if (rtn.acknowledged) {
      req.flash('msg', { class:"green", text:'ตั้งค่าเริ่มต้นของระบบ สำเร็จ' })
      res.redirect(PATH_LOGIN)
    } else {
      req.flash('msg', { class:"red", text:'ตั้งค่าเริ่มต้นของระบบ ไม่สำเร็จ !!!' })
      res.redirect(PATH_LOGIN)
    }
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})





export default router
