/* import XLSX from "xlsx" */
// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
// import { DateTime } from 'luxon'
// import multer from 'multer'
// import sharp from 'sharp'
// import * as myData from "../mymodule/myData.js"
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js"
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const PATH_MAIN = '/data'
const PATH_ID = `${PATH_MAIN}/:id`
const PATH_GET_ALERTS = '/get-alerts'

//================================================================
// 
// 
router.get(PATH_ID, mainAuth.isAuth , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  // จับข้อมูล id เพิ่มเติม
  const { id } = req.params

  // ตรวจสอบ id ว่าถูกต้องไหม
  if(!id || !/^e\d{3}$/.test(id)){
    req.flash('msg', { class:"red", text:`${new Error("Not Found")}{{sep}}"${id}"` })
    return res.redirect('/dashboard')
  }

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(id)

    //=== 1.) จับข้อมูลอุปกรณ์ทั้งหมด
    const coll_devices = db.collection(global.dbColl_devices)
    const device = await coll_devices.findOne(
      { deviceId : id } ,
      { projection: { _id:0, changesHistory:0 } }
    )
    // console.log('device ===> ', device)

    //==== เแบบนี้ขั้นตอนเยอะไป - แต่เก้บไว้ก่อน **** ห้ามลบ ****
    // // จับ Unique keys ใน collection นี้
    // // - วนลูปตาม keysUniqueInCollection เพื่อดึงข้อมูลของแต่ละ key ในวันปัจจุบัน และจำนวนไม่เกิน MAX_POINTS
    // const keysUniqueInCollection =  await collection.distinct("key");
    // const dataPromises = keysUniqueInCollection.map( async (key) => {
    //   const data = await collection.aggregate([
    //     { $match: { key: key } },
    //     { $project: { _id : 0 } },
    //     { $sort: { timeInterval: -1 } }, // เรียงจากใหม่ไปเก่า
    //     { $limit: MAX_POINTS }
    //   ]).toArray()
    //   data.reverse() // กลับลำดับให้เป็นเก่าสุด -> ใหม่สุด
    //   return data
    // })
    // const dataArrays = await Promise.all(dataPromises)
    // const data = dataArrays.flat()

    //=== 2.) จับข้อมูลให้มากกว่า MAX_POINTS จำนวนประมาณ 3.2 เท่า เผื่อไว้นิดหน่อย แล้วไป slice เอาเองที่ client
    const keysUniqueInCollection =  await collection.distinct("key");
    const totalRecords = await collection.countDocuments()
    const maxCapture = Math.ceil( (keysUniqueInCollection.length+0.2) * global.MAX_POINTS)
    const data = await collection.aggregate([
      { $project: { _id : 0 } },
      { $skip: Math.max(0, totalRecords - maxCapture) },
      { $limit: maxCapture }
    ]).toArray()

    //=== 3.) กรองเอาข้อมูลของ keys จาก จับ dataKeysDefinition
    // const coll_keysDefinition = db.collection(global.dbColl_keysDefinition)
    // const dataKeysDefinition = await coll_keysDefinition.find(
    //   {},
    //   { projection: { _id:0 } }
    // ).toArray()
    const keyObj = global.KEYS_DEFINITION.filter( obj => keysUniqueInCollection.includes(obj.key) )

    // //=== สำหรับทดสอบเท่านั้น
    // // ใช้ fs เขียนข้อมูลลงไฟล์ .json เผื่อเอาไปใช้กับ client
    // const filePath = path.join(global.folderViews, `${id}.json`)
    // await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    // console.log(`Write data to ${filePath} complete.`)

    //=== 4.) นับข้อมูลแจ้งเตือน สำหรับยูสเซอร์นี้(ยังไม่ถูกอ่าน)
    const coll_alerts = db.collection(global.dbColl_alerts)
    const user = myUsers.getSessionData(req)
    const count_alert = await coll_alerts.countDocuments({ 
      $and: [
        { deviceId: id }, // กรองเฉพาะอุปกรณ์นี้
        { // และ ยังไม่ถูกอ่านโดยยูสเซอร์นี้ หรือไม่มีฟิลด์ readRows
          $or: [        
            { readRows: { $exists: false } },
            { readRows: { $not: { $elemMatch: { userId: user.userId } } } }
          ]
        }
      ]
    });
    console.log('count_alert ===> ', count_alert)

    const html = await myModule.renderView("dataById", res, {
      title: `${device.deviceName} [${id}]`,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user,
      ...await myModule.getSettings(),

      count_alert,

      device,
      keyObj,
      data,

      PATH_GET_ALERTS,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})








export default router





// //=============================================
// //
// router.post(PATH_LOAD, mainAuth.isOA, async (req, res) => {  
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
// router.post(PATH_PRINT, mainAuth.isOA, async (req, res) => {  
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





/* 

รายการ ESP32 ทั้งหมด ค่าต่างๆ ล่าสุด - ไม่ต้องแสดง Chart
- e001, e002, e003, e004, e005
t = temperature
h = humidity
i = current
v = voltage

- Web Socket จะส่งข้อมูลมาที่นี่ แล้วเปลี่ยนค่าต่างๆ ในหน้านี้ให้ทันที

*** มีแยกย่อยเป็นหน้าสำหรับ ESP32 แต่ละตัว (แสดง Chart ได้) เช่น /e001, /e002, /e003, /e004, /e005

*/