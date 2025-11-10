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
const PATH_MAIN = '/report'
const PATH_ID = `${PATH_MAIN}/:deviceId`
const PATH_REPORT = {
  report1: `${PATH_MAIN}/generate-report-1`,
  report2: `${PATH_MAIN}/generate-report-2`,
}


//================================================================
// 
// 
router.get(PATH_ID, mainAuth.isAuth , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.params)

  
  const { deviceId } = req.params

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(deviceId)
    const coll_devices = db.collection(global.dbColl_devices)

    const findDevice = await coll_devices.findOne(
      { deviceId: deviceId }, 
      { projection: { _id:0, changesHistory:0 } }
    )
    const device = {
      deviceId: deviceId,
      deviceName:  findDevice?.deviceName || '',
      deviceBgClassColor: findDevice?.deviceBgClassColor || 'bg-eee',
    }

    //=== จับคีย์ในฐานข้อมูล 
    const keysUniqueInCollection =  await collection.distinct("key");
    const keyObj = global.KEYS_DEFINITION.filter( obj => keysUniqueInCollection.includes(obj.key) )

    //=== 
    const html = await myModule.renderView("reportById", res, {
      title: `[${deviceId}] รายงาน`, 
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user: await myUsers.getUserData(req),
      ...await myModule.getSettings(),

      device,
      keyObj,
      PATH_REPORT,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})




//================================================================
// สร้างข้อมูลจำแนกตามจำนวนวัน
// - 
router.post(PATH_REPORT.report1, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log('req.body ===> ', req.body)

  // ตรวจสอบ id ว่าถูกต้องไหม
  const { deviceId, selectDaysNumber } = req.body
  if(!deviceId || !/^e\d{3}$/.test(deviceId)){
    return res.send(JSON.stringify({ isCreate:false, class:"red", msg: 'Not Found' }))
  }

  const client = new MongoClient(global.dbUrl);  
  await client.connect()
  try{ 
    const db = client.db(global.dbName)
    const collection = db.collection(deviceId)

    //=== 1.) dateStart จาก วันนี้ - (selectDaysNumber - 1)
    const dateToday = myDateTime.getDate() 
    const dateStart = myDateTime.getDate(-selectDaysNumber+1)

    //=== 2.) สร้างวันที่เก็บไว้ในอาเรย์ เริ่มตั้งแต่ dateStart ถึง dateToday
    const dateArray = []
    for(let d = 0; d < selectDaysNumber; d++){
      const dt = myDateTime.getDate(-selectDaysNumber+1 + d)
      dateArray.push(dt)
    }

    //=== 3.) จับข้อมูลใน collection แบบแยกวัน เริ่มตั้งแต่วันที่ dateStart ถึง dateToday
    // โดยดูจากฟิลด์ timeInterval ซึ่งอยู่ในรูปแบบ 2025-09-16 14:30
    const dataDocs = await collection.aggregate([
      { $match: {
          timeInterval: {
            $gte: `${dateStart} 00:00`, 
            $lte: `${dateToday} 23:59` 
          }
        } 
      },
      { $project: {  _id : 0 } },
      { $sort: { date: 1, time: 1 } },
    ]).toArray()

    //=== 4.) จับข้อมูลมาแยกตามวัน
    const dataDocsProcessed = dateArray.map( dt => {
      return {
        date: dt,
        data: dataDocs.filter( doc => doc.timeInterval.startsWith(dt) )
      }
    })

    //=== 5.) เขียนข้อมูลลงฐานข้อมูล setData
    const coll_setData = db.collection(`${deviceId}_dataByDates`)
    await coll_setData.deleteMany({})
    if(dataDocsProcessed.length > 0){
      var result = await coll_setData.insertMany(dataDocsProcessed)
    }else{
      var result = { insertedCount: 0 }
    }
    // console.log(`result ===> ` , result);

    return res.send(JSON.stringify({
      isCreate:true, 
      class:"green", 
      msg: "สร้างรายงานเรียบร้อยแล้ว",
      result
    }))
  } catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isCreate:false, 
      class:"red", 
      msg: err.message
    }))
  }
})

//================================================================
// จับข้อมูลตามที่สร้างใน report1
// - 
router.get(`${PATH_REPORT.report1}/:deviceId`, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log('req.query ===> ', req.query)
  // console.log('req.params ===> ', req.params)

  // ตรวจสอบ id ว่าถูกต้องไหม
  const { deviceId } = req.params
  if(!deviceId || !/^e\d{3}$/.test(deviceId)){
    return res.send(JSON.stringify({ isCreate:false, class:"red", msg: 'Not Found' }))
  }

  const client = new MongoClient(global.dbUrl);  
  await client.connect()
  try{ 
    //=== 1) ฐานข้อมูล
    const db = client.db(global.dbName)
    const collection = db.collection(`${deviceId}_dataByDates`)

    //=== 2.) จับข้อมูลทั้งหมด
    const dataAll = await collection.find(
      {}, 
      { projection : { _id : 0 } }
    ).toArray()

    //=== 
    const keysUnique = [...new Set(dataAll.flatMap( obj => obj.data.map( d => d.key ) ))]
    const keyObj = global.KEYS_DEFINITION.filter( obj => keysUnique.includes(obj.key) )

    //=== 3.) จับ  Unique Date 
    const dates = dataAll.map( d => d.date )


    return res.send(JSON.stringify({
      isLoad:true, 
      class:"green", 
      msg: "โหลดข้อมูลเรียบร้อยแล้ว",
      dates,
      dataAll,
      keyObj,
    }))
  } catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isLoad:false, 
      class:"red", 
      msg: err.message
    }))
  } finally{
    client.close();
  }

});


//================================================================
//
// 
router.post(PATH_REPORT.report2, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log('req.body ===> ', req.body)

  // ตรวจสอบ id ว่าถูกต้องไหม
  const { id } = req.body
  if(!id || !/^e\d{3}$/.test(id)){
    return res.send(JSON.stringify({isCreate:false, class:"red", msg: 'Not Found' }))
  }


  const client = new MongoClient(global.dbUrl);  
  await client.connect()
  try{ 
    //=== 1) ฐานข้อมูล
    const db = client.db(global.dbName)
    const collection = db.collection(id)

    await new Promise(resolve => setTimeout(resolve, 50));

    return res.send(JSON.stringify({
      isCreate:true, 
      class:"green", 
      msg: "สร้างรายงานเรียบร้อยแล้ว"
    }))
  } catch(err){
    console.log(err)
    return res.send(JSON.stringify({
      isCreate:false, 
      class:"red", 
      msg: err.message
    }))
  }
})






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






export default router





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