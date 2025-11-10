// import { ObjectId } from 'mongodb'
// import request from 'request'
// const PREFIX = PATH_LOGIN.replace(/\//g,"_") 
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js" 
import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
import { DateTime } from 'luxon'
import mainAuth from "../middleware/mainAuth.js" 
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const PATH_LOGIN = '/login'
const PATH_LOGOUT = '/logout'
const PATH_FORGOT_PASSWORD = `/password`

//======================================================================
// 
// 
router.get(PATH_LOGIN, mainAuth.isLogged, async (req,res) => {
  // console.log(`--------${req.originalUrl}------------`)
  // console.log(dataSettings)

  try{
     const html = await myModule.renderView('login', res, {
      title: global.PAGE_LOGIN ,
      time: myDateTime.getDate(),  // DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd') ,
      msg: req.flash('msg'),
      ...myUsers.getSessionData(req),
      userFlash: req.flash('userFlash'),
      settings : await myModule.getSettings(),

      PATH_LOGIN ,
      PATH_FORGOT_PASSWORD  ,
    })
    return res.send(html)
  }catch(err){
    console.log(err.message)
    res.status(404).sendFile(file404)
  }
})
//=================================================
// 
router.post(PATH_LOGIN, mainAuth.isLogged, async (req,res) => {
  // console.log(`--------${req.originalUrl}------------`)
  // console.log(req.body)
  // console.log(req.query)

  const{ userNameEmail, userPassword } = req.body

  const client = await MongoClient.connect(global.dbUrl)
  const db = client.db(global.dbName)
  const coll_users = db.collection(global.dbColl_users)
  const coll_userBranches = db.collection(global.dbColl_userBranches)

  try {      
    
    //=== 1) ค้าหาจาก username/email ก่อน
    const userFind = await coll_users.findOne(
      { $and: [
          { $or: [
              { userEmail: userNameEmail },                 
              { username: userNameEmail }
            ] 
          },
          { userIsActive: 'active' }
        ] 
      }
    )

    //=== 2) ถ้าไม่พบให้ค้นหาจาก userId
    if (!userFind) {
      req.flash('msg', { class:"red", text:`ไม่พบผู้ใช้ หรือ ผู้ใช้ไม่ได้เปิดใช้งาน` })
      req.flash('user', { userNameEmail:userNameEmail, userPassword:userPassword })
      return res.redirect(PATH_LOGIN)
    }

    //=== 3) เปรียบเทียบพาสเวิร์ดต่อ
    const isMatchPassword = await bcrypt.compare(userPassword, userFind.userPassword);
    if (!isMatchPassword) {
      req.flash('msg', { class:"red", text:`รหัสผ่านไม่ถูกต้อง` })
      req.flash('user', { userNameEmail:userNameEmail, userPassword:userPassword })
      return res.redirect(PATH_LOGIN)
    }

    //=== 4) บันทึกจำนวนการ Login
    await coll_users.updateOne(
      { _id: userFind._id },
      {
        $set: { userLastLogin: DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd') }, 
        $inc: { userNormalLoginCount: 1 }
      }
    )

    //=== 5) เซ็ตข้อมูลผู้ใช้ลงใน session *****
    // - ต้องเอาไปใช้หลายที่ ****************
    // const user_id = 
    // const userId = userFind.userId
    // const userAuthority = userFind.userAuthority
    // const username = userFind.username
    // const userFullname = `${userFind.userPrefix} ${userFind.userFirstname} ${userFind.userLastname}`.trim()
    req.session.isAuth = true ;
    req.session.user_id = userFind._id.toString()
    req.session.userId = userFind.userId // เป็นตัวเลข
    req.session.userAuthority = userFind.userAuthority
    req.session.username = userFind.username
    req.session.userEmail = userFind.userEmail
    req.session.userPhone = userFind.userPhone
    req.session.userPrefix = userFind.userPrefix
    req.session.userFirstname = userFind.userFirstname
    req.session.userLastname = userFind.userLastname
    req.session.userFullname = `${userFind.userPrefix} ${userFind.userFirstname} ${userFind.userLastname}`.trim()
    req.session.branchId = userFind.branchId
    const branch =await coll_userBranches.findOne(
      { branchId: userFind.branchId },
      { projection: { _id:0, branchName:1 } }
    )
    if(branch){ req.session.branchName = branch.branchName }

    req.flash('msg', { class:"green", text:"เข้าสู่ระบบสำเร็จ" })
    return res.redirect("/")
  } catch (error) {  
    console.log("Error ===> ", error.message) 
    req.flash('msg', { class:"red", text:error.message })
    return res.redirect(PATH_LOGIN); 
  }finally{
    client.close();
  } 

})


//===================================================
// ลบ Session แต่ Cookie ยังอยู่
// - ลบ Session ใน MongoDB ???? 
// router.post(PATH_LOGOUT, mainAuth.isAuth, (req,res) => {
router.get(PATH_LOGOUT, mainAuth.isAuth, (req,res) => {
  req.session.destroy( (err) => {
    if(err) throw err
    res.redirect(PATH_LOGIN)
  })
})





export default router







