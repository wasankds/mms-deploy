/* import XLSX from "xlsx" */
// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
// import { DateTime } from 'luxon'
// import multer from 'multer'
// import sharp from 'sharp'
// import * as myData from "../mymodule/myData.js"
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient } from 'mongodb'
import * as myDateTime from "../mymodule/myDateTime.js"
import * as myUsers from "../mymodule/myUsers.js"
import * as myModule from "../mymodule/myModule.js"
import mainAuth from "../middleware/mainAuth.js"
const PATH_MAIN = '/data'
const PATH_MAIN_ID = `${PATH_MAIN}/:id`
// const PATH_LOAD = `${PATH_MAIN}/load`
// const PATH_PRINT = `${PATH_MAIN}/print`
// const PATH_VIEW = `${PATH_MAIN}/view`
// const PATH_SAVE = `${PATH_MAIN}/save`
// const PATH_DELETE = `${PATH_MAIN}/delete`
// const PATH_FETCH = `${PATH_MAIN}/fetch`
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 


//================================================================
// หน้าสำหรับแสดงจข้อมูลจาก esp32 1 ตัว ตาม id ที่ส่งมา
// - แสดงค่าล่าสุด
// - แสดงกราฟย้อนหลัง 200 docs และอัปเดท Real-time ผ่าน web socket
// 
router.get(PATH_MAIN_ID, mainAuth.isAuth , async (req, res) => {
  console.log(`-----------------${req.originalUrl}------------------`) 
  console.log(`-----------------${req.path}----------------------`)
  console.log(req.params)
  // console.log(req.query)

  const { id } = req.params

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(id)
    const data = await collection.find({}, { projection : { _id : 0 } }).toArray()

    return res.json(data)

    const html = await myModule.renderView("dashboard", res, {
      title: PAGE_DASHBOARD,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user: await myUsers.getUserData(req),
      ...await myModule.getSettings(),

      dataAll: data,
      ids: ids,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})




// //=============================================
// //
// router.post(PATH_LOAD, mainAuth.isOS, async (req, res) => {  
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> ", req.body)

//   const loadId = req.body.loadId
//   const sip = req.body.sip?.toString().replace(/[!@#$%^&*\///]/g, '')??''
//   const scid = req.body.scid
//   const sis = req.body.sis
//   const rpp = Number(req.body.rpp) || 30
//   const page = Number(req.body.page) || 1
//   // console.log("loadId ===> " , loadId)
//   // console.log("sip ===> " , sip)
//   // console.log("scid ===> " , scid)
//   // console.log("sis ===> " , sis)
//   // console.log("rpp ===> " , rpp)
//   // console.log("page ===> " , page)

//   const redirectUrl_normal = `${PATH_MAIN}?`+
//                              `sip=${sip}&scid=${scid}&sis=${sis}` +
//                              `&rpp=${rpp}&page=${page}&loadId=${loadId}`

//   const client = new MongoClient(global.dbUrl)
//   try{
//     const db = client.db(global.dbName)
//     const coll_items = db.collection(global.dbColl_items)
//     const docItem = await coll_items.findOne({ itemId:loadId }, { projection : { _id : 0 } })

//     // console.log("docItem ===> ", docItem) 
//     //=== โหลดที่ path main
//     // if(docItem.itemImage){
//     //   const imagePath = path.join(folderItems, docItem.itemImage);
//     //   try {
//     //     const imageBuffer = await fs.promises.readFile(imagePath);
//     //     docItem.itemImageBase64 = imageBuffer.toString('base64');
//     //   } catch (err) {
//     //     console.log("Error reading image file:", err.message);
//     //     docItem.itemImageBase64 = null;
//     //   }
//     // }

//     if( docItem ){
//       req.flash('msg', null)
//       return res.redirect(redirectUrl_normal)
//     }else{  
//       req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${loadId}"` })
//       return res.redirect(PATH_MAIN)
//     }
//   }catch(err){
//     console.log(err.message)
//     req.flash('msg', { class:"red", text:`${err.message}` })
//     return res.redirect(PATH_MAIN)
//   }finally{
//     client.close()
//   }
// })






// //=============================================
// //
// // 
// router.post(PATH_PRINT, mainAuth.isOS, async (req, res) => {  
//   // console.log(`-----------------${req.originalUrl}------------------`)
//   // console.log("req.body ===> ", req.body)

//   const { itemIdArr: itemIdArr } = req.body

//   const client = new MongoClient(global.dbUrl)
//   try {
//     await client.connect()
//     const db = client.db(global.dbName)
//     const collection = db.collection(global.dbColl_items)

//     //=== 1.) ค้นหาไอเท้ม
//     const itemsFind = await collection.aggregate([
//       { $match: { 
//           itemId: { $in: itemIdArr }
//         } 
//       },
//       { $project: {  _id : 0 } },      
//       { $addFields: { // เรียงลำดับตามอาเรย์ jobIdArr ที่ส่งมา
//           __order: { $indexOfArray: [itemIdArr, "$itemId"] } 
//         }
//       },
//       { $sort: { __order: 1 } },
//     ]).toArray()


//     //=== 2.) ตรวจสอบว่ามีข้อมูลที่จะพิมพ์หรือไม่
//     if(itemsFind.length == 0){
//       return res.send(JSON.stringify({
//         isPrint : false,
//         class : "red",
//         msg: `ไม่มีข้อมูลที่จะพิมพ์` , 
//       }))
//     }


//     //=== 3.) สร้างฟอร์มจาก HTML
//     const templatePath = path.join(folderForm, 'formItems.ejs')
//     const templateContent = fs.readFileSync(templatePath, 'utf8'); 
//     const htmlPage = ejs.render(templateContent, {
//       web_title : `Print ${itemsFind.length} Items`,
//       title : `ไอเท็ม`,
//       data : itemsFind,
//       dateTime : DateTime.now().setZone('Asia/Bangkok').toFormat('yyyy-MM-dd HH:mm'),
//     })

//     res.send(JSON.stringify({
//       isPrint : true,
//       class : "green",
//       htmlPage : htmlPage ,
//       msg: `พิมพ์ ${itemsFind.length} ไอเท็มเรียบร้อยแล้ว` ,
//     }))
//   } catch (err) {
//     console.log("error ===> ", err);
//     res.send(JSON.stringify({
//       isPrint : false,
//       class : "red",
//       msg: err.message , 
//     }))
//   } finally {
//     client.close();
//   } 
// })






export default router


