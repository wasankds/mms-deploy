

// import { exec } from 'child_process' // สำหรับรันคำสั่ง Terminal
// import path from 'path'
// import * as myModule from "../mymodule/myModule.js"
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js" 
// const PATH_RESTART_PM2 = `${PATH_MAIN}/restart-pm2`
// const PATH_BACKUP_DB = `${PATH_MAIN}/backup-db`
// const PATH_DELETE_ITEMS = `${PATH_MAIN}/delete-items`
// const PATH_UPDATE_SYSTEM = `${PATH_MAIN}/update-system`
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 
import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js" 
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const PATH_MAIN = '/manage/settings/system'
const PATH_SAVE = `${PATH_MAIN}/save`


//=======================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isO ,async (req, res) => {
  // console.log(`-----------------${req.originalUrl}----------------------`)
  // console.log("req.query ===> " , req.query)
  
  //=== query string สำหรับคลิก tab เช่น tab=4
  const { tab:tabNumberClicked } = req.query

  const client = new MongoClient(dbUrl)
  try {
    const db = client.db(dbName);
    const collection = db.collection(dbColl_settingsSystem)
    const settingsSystem = await collection.findOne({})

    const html = await myModule.renderView("manageSettingsSystem", res, {
      title: PAGE_MANAGE_SETTINGS_SYSTEM,
      time: myDateTime.getDate(),
      msg: req.flash('msg'),
      user : myUsers.getSessionData(req),
      ...await myModule.getSettings(),

      tabNumberClicked,
      PATH_MAIN , 
      // PATH_SAVE,
      PATH_MAIN,
      PATH_SAVE,
      // PREFIX ,
      // PATH_RESTART_PM2,
      // PATH_BACKUP_DB,
      // PATH_UPDATE_SYSTEM,

      //===
      settingsSystem,
    })
    res.send(html)
  } catch (err) {
    console.log(err.message)
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }
})


//=======================================================
// ใช้กับทั้ง Create และ Update
// 
router.post(PATH_SAVE,  mainAuth.isO , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)

  // return res.redirect(PATH_MAIN)
  const path_redirect = `${PATH_MAIN}?tab=1`
  const client = new MongoClient(global.dbUrl)
  try {
    //=== เขียนลงฐานข้อมูล
    await client.connect()
    const db = client.db(global.dbName);
    const collection = db.collection(global.dbColl_settingsSystem)
    await collection.deleteMany({})
    const rtn = await collection.insertOne(req.body)
    if( rtn.acknowledged){
      req.flash('msg', { class:"green", text:`บันทึกข้อมูลการตั้งค่าอิเมล์แล้ว`})
      res.redirect(path_redirect)
    }else{
      req.flash('msg', { class:"red", text:`Error while saving setting data`})
      res.redirect(path_redirect)
    }
  } catch (err) {
    console.log("error ===> ", err.message);
    res.status(404).sendFile(file404)
  } finally {
    client.close()
  }

})


// //=======================================================
// // ใช้กับทั้ง Create และ Update
// // 
// router.post(PATH_SAVE,  mainAuth.isO , async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> " , req.body)


//   const client = new MongoClient(dbUrl)
//   try {
//     // //=== Category 
//     // let postCategoryLength = 0
//     // if(typeof req.body.postCategoryId == 'string'){
//     //   postCategoryLength = 1
//     // }else if(typeof req.body.postCategoryId == 'object'){
//     //   postCategoryLength = req.body.postCategoryId.length
//     // }
//     // req.body.postCategoryId ? req.body.postCategoryId.length : 0 ; 

//     // const postCategory = []
//     // if(postCategoryLength > 1){
//     //   const postCategoryActive = req.body.postCategoryActive
//     //   const postCategoryId = req.body.postCategoryId
//     //   const postCategoryName = req.body.postCategoryName
//     //   const postCategorySplashImage  = req.body.postCategorySplashImage 
//     //   const postCategorySplashUrl  = req.body.postCategorySplashUrl 
//     //   const postCategorySplashActive  = req.body.postCategorySplashActive 
//     //   const postCategorySplashClick  = req.body.postCategorySplashClick 
//     //   for(let i=0; i<=postCategoryLength-1; i++){
//     //     postCategory.push({
//     //       postCategoryActive:postCategoryActive[i] ,
//     //       postCategoryId:postCategoryId[i] ,
//     //       postCategoryName:postCategoryName[i] ,
//     //       postCategorySplashImage:postCategorySplashImage[i] ,
//     //       postCategorySplashUrl:postCategorySplashUrl[i] ,
//     //       postCategorySplashActive:postCategorySplashActive[i] ,
//     //       postCategorySplashClick:postCategorySplashClick[i] ,
//     //     })
//     //   }
//     // }else if(postCategoryLength == 1){
//     //   postCategory.push({
//     //     postCategoryActive:req.body.postCategoryActive,
//     //     postCategoryId:req.body.postCategoryId,
//     //     postCategoryName:req.body.postCategoryName,
//     //     postCategorySplashImage:req.body.postCategorySplashImage,
//     //     postCategorySplashUrl:req.body.postCategorySplashUrl,
//     //     postCategorySplashActive:req.body.postCategorySplashActive,
//     //     postCategorySplashClick:req.body.postCategorySplashClick,
//     //   })
//     // }
//     // delete req.body.postCategoryActive
//     // delete req.body.postCategoryId
//     // delete req.body.postCategoryName
//     // delete req.body.postCategorySplashImage
//     // delete req.body.postCategorySplashUrl
//     // delete req.body.postCategorySplashActive
//     // delete req.body.postCategorySplashClick
//     // req.body.postCategory = [...postCategory]

//     //=== เขียนลงฐานข้อมูล
//     await client.connect()
//     const db = client.db(dbName);
//     const collection = db.collection(dbColl_settingsSystem)
//     await collection.deleteMany({})
//     const rtn = await collection.insertOne(req.body)

//     if( rtn.acknowledged){
//       req.flash('msg', { class:"green", text:`บันทึกข้อมูลการตั้งค่าระบบแล้ว`})
//       res.redirect(PATH_MAIN)
//     }else{
//       req.flash('msg', { class:"red", text:`Error while saving setting data`})
//       res.redirect(PATH_MAIN)
//     }

//   } catch (err) {
//     console.log("error ===> ", err.message);
//     res.status(404).sendFile(file404)
//   } finally {
//     client.close()
//   }

// })








// //=======================================================
// //
// router.post(PATH_RESTART_NODE,  mainAuth.isO , async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> " , req.body)

//   //=== เปิดหัว Que
//   const queueArr = []
//   let processingQue = false
//   const processQueueFunc = async () => {
//     if (queueArr.length === 0) {
//       processingQue = false
//       return
//     }
//     processingQue = true
//     const {req,res} = queueArr.shift()
//     await handleRequest(req, res)
//     processQueueFunc()
//   }

//   //===
//   const handleRequest = async (req, res) => {
//     try {
//       const currentNodePath = process.argv[1]
//       const currentFileName = currentNodePath.split(/[\\/]/).pop()
//       const chgDir = `cd ${currentNodePath}` // path ที่รัน server
//       // const restartNode = `pm2 restart ${currentFileName}`
//       const restartNode = `node ${currentFileName}`
//       // cd D:\aWK_LeaseSystem\HomeAutomation_Demo
//       // pm2 restart app_home.js
      
//       //=== ต้องอยู่ก่อนการรันคำสั่ง exec - ไม่เช่นนั้นหน้าเว็บจะค้าง
//       req.flash('msg', { class:"green", text:`Restart Node process success`})
//       res.redirect(PATH_MAIN)
//       exec(`${chgDir} && ${restartNode}`, (error, stdout, stderr) => {
//         // if (error) {
//         //   console.error(`exec error: ${error}`);
//         //   return;
//         // }
//         // console.log(`stdout: ${stdout}`);
//         // console.error(`stderr: ${stderr}`);
//       });
//     } catch (err) {
//       req.flash('msg', { class:"red", text:err.message})
//       res.redirect(PATH_MAIN)
//     }
//   }

//   //=== ปิดท้าย - ทำตรงนี้ก่อน
//   queueArr.push({req,res})
//   if (!processingQue) {
//     processQueueFunc() 
//   }
// })



export default router