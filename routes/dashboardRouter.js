/* import XLSX from "xlsx" */
// import ejs from 'ejs'
// import { DateTime } from 'luxon'
// import multer from 'multer'
// import sharp from 'sharp'
// import * as myData from "../mymodule/myData.js"
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 
// const myData = await import(`../${mymoduleFolder}/myData.js`)
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js"
import path from 'path'
import fs from 'fs'
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const myData = await import(`../${mymoduleFolder}/myData.js`)
const PATH_MAIN = '/dashboard'
const PATH_DATA_BY_ID = `/data` // ดูข้อมูลรายตัว
const PATH_REPORT = `/report`
const PATH_DEVICES_SORTING = `/devices-sorting`
const PATH_DEVICE_IMAGES = `/device-images`

//================================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isAuth , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  const client = new MongoClient(global.dbUrl)
  try{
    const user = myUsers.getSessionData(req)

    await client.connect()
    const db = client.db(global.dbName)

    //=== 1.) จับข้อมูลอุปกรณ์ทั้งหมด - สำหรับ lookup ชื่ออุปกรณ์/สีอุปกรณ์
    // - จับข้อมูลแบบ Lightweight ระบุเป็น step=1
    const devices = await myData.getDataDevices(1)
    
    //=== 2.) พิจารณาเรียงลำดับอุปกรณ์ และ การกรองการแสดงผลอุปกรณ์
    const coll_devicesSorting = db.collection(global.dbColl_deviceSorting)
    const devicesSorting_ByUserId = await coll_devicesSorting.findOne(
      { userId : user.userId  },
      { projection: { _id:0 } }
    )
    if(devicesSorting_ByUserId){
      const devicesRow = devicesSorting_ByUserId.devicesRow || []
      
      //=== 2.1) กรองการแสดงผลอุปกรณ์ - ลบ device ออกไปที่ deviceShow = 0
      devices.forEach( (device, index) => {
        const deviceInSorting = devicesRow.find( row => row.deviceId === device.deviceId )
        if(deviceInSorting && deviceInSorting.deviceShow === 0){
          devices.splice(index, 1)
        }
      })

      //=== 2.2) เรียงตามอาเรย์ sortArrays ถ้ามีในอาเรย์นี้
      devices.sort( (a, b) => {
        const indexA = devicesRow.findIndex(row => row.deviceId === a.deviceId);
        const indexB = devicesRow.findIndex(row => row.deviceId === b.deviceId);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return -1;
        if (indexB === -1) return 1;
        return indexA - indexB;
      });

    }
    // console.log(devices)

    //=== 3 : Deep Copy of devices - สำหรับใช้ Lookup ใน View
    // - มีเฉพาะ device ที่ผ่านการกรองการแสดงผลแล้ว
    // - ไม่มีข้อมูล ที่ไม่ควรเห็น
    const dataDevices = JSON.parse(JSON.stringify(devices))   
    // console.log('dataDevices ===> ', dataDevices)

    //=== 4.) จับข้อมูลอุปกรณ์ทุกตัว ในช่วง 10 นาทีล่าสุด ใน collection ตามชื่อ deviceId
    // - ซึ่งควรจะมี ข้อมูลแค่ 0 หรือ 1 เอกสารเท่านั้น
    // - ถ้าไม่ขึ้นแสดงว่า ไม่มีข้อมูลในช่วง 10 นาทีล่าสุดของอุปกรณ์นั้น - อุปกรณ์อาจเสีย
    const nowInTenMinute = myDateTime.now().substring(0, 15) + '0'; // 2025-10-24 09:00
    for(const device of devices){
      const doc = await db.collection(device.deviceId)
                          .find({ timeInterval: nowInTenMinute })
                          .project({ _id: 0 })
                          .toArray();
      device.data = doc
    }

    //=== 5.) เพิ่ม keyName/keyUnit ให้กับแต่ละ key ใน devices5
    // - และจัด format min, max, avg ให้เป็นทศนิยม 2 ตำแหน่ง
    // - KEYS_DEFINITION จับจากฐานข้อมูลใส่ตัวแปล global.KEYS_DEFINITION แล้วตั้งแต่เปิดระบบ
    devices.forEach(item => {
      item.data = item.data.map( dt => {
        const findKey = global.KEYS_DEFINITION.find(k => k.key === dt.key);
        return {
          ...dt,
          // แปลงเป็นสตริงทศนิยม 2 ตำแหน่ง - สำหรับแสดงผล
          min: dt.min !== undefined ? Number(dt.min).toFixed(2) : dt.min,
          max : dt.max !== undefined ? Number(dt.max).toFixed(2) : dt.max,
          avg : dt.avg !== undefined ? Number(dt.avg).toFixed(2) : dt.avg,
          // find
          keyName: findKey ? findKey.keyName : null,
          keyUnit: findKey ? findKey.keyUnit : null,
          bgColor: findKey ? findKey.bgColor : 'bg-ccc',
          fontColor: findKey ? findKey.fontColor : 'fc-black',
        };
      });
    });

    // return res.json(devices); 

    //=== 6.) นับ alert ที่ยังไม่อ่าน - เฉพาะของ user นี้ (ทุกอุปกรณ์)
    const coll_alerts = db.collection(global.dbColl_alerts)
    const count_alert = await coll_alerts.countDocuments({ 
      $or: [
        { readRows: { $exists: false } },
        { readRows: { $not: { $elemMatch: { userId: user.userId } } } }
      ]
    });

    //=== 7.) Render View
    const html = await myModule.renderView("dashboard", res, {
      title: PAGE_DASHBOARD,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user, 
      settings : await myModule.getSettings(),
      
      dataDevices,
      dataAll : devices,
      count_alert,

      PATH_REPORT,
      PATH_DATA_BY_ID,
      PATH_DEVICES_SORTING,
      PATH_DEVICE_IMAGES,
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
// ใช้สำหรับ fetch ภาพเป็น base64 - ใช้กับภาพ thumbnail ในตาราง
// 
// 
router.get(`${PATH_DEVICE_IMAGES}/:deviceId`, mainAuth.isAuth , async (req, res) => {
  try {
    const deviceId = req.params.deviceId
    const deviceImagePath = path.join(global.folderDevices, `${deviceId}.jpg`)
    if (fs.existsSync(deviceImagePath)) {
      const imageData = await fs.promises.readFile(deviceImagePath);
      const base64 = imageData.toString('base64');
      const base64Image = `data:image/jpeg;base64,${base64}`;
      res.send(base64Image);

      // //=== ส่งกลับเป็นภาพไปแสดงในหน้าเว็บ - ไม่ต้องเขียน JS
      // const imgBuffer = Buffer.from(base64, 'base64');
      // res.writeHead(200, {
      //   'Content-Type': 'image/jpeg',
      //   'Content-Length': imgBuffer.length
      // });
      // res.end(imgBuffer);
    }else{
      res.send(null)
    }
  } catch (err) {
    console.error('Error reading device image:', err);
    res.status(500).send('Error reading device image');
  }
})


export default router





// //================================================================
// // 
// // 
// router.get(PATH_SORTING, mainAuth.isAuth , async (req, res) => {
//   // console.log(`-----------------${req.originalUrl}------------------`) 
//   // console.log(req.query)

//   const client = new MongoClient(global.dbUrl)
//   try{
//     await client.connect()
//     const db = client.db(global.dbName)

//     //=== 1.) จับชื่อ collections ที่ขึ้นต้นด้วย e ตามด้วยตัวเลข 3 ตัว
//     // - นับจำนวนเอกสารในแต่ละ collection ที่กรองมา
//     // - ถ้า Collection ไม่มี document ให้ลบ Collection นั้นทิ้ง
//     const collName_of_devices = await db.listCollections().toArray()
//     collName_of_devices.sort( (a, b) => a.name.localeCompare(b.name) ) 
//     const filteredColls = collName_of_devices.map(coll => coll.name).filter(name => /^e\d{3}$/.test(name));
//     for (const collName of filteredColls) {
//       const count = await db.collection(collName).countDocuments();
//       if (count === 0) {
//         await db.collection(collName).drop();
//         // หลัง drop() ลบชื่อ collection ออกจาก filteredColls
//         const index = filteredColls.indexOf(collName);
//         if (index > -1) {
//           filteredColls.splice(index, 1);
//         }
//       }
//     }

//     //=== 2.) เรียงตามอาเรย์ sortArrays ถ้ามีในอาเรย์นี้
//     // - ดึง sortArrays จากฐานข้อมูล
//     // - อะไรที่ไม่มีในอาเรย์นี้ ให้เอาไว้ข้างหลังสุด
//     const coll_devicesSorting = db.collection(global.dbColl_deviceSorting)
//     const sortArrays = await coll_devicesSorting.find().toArray();
//     // console.log("sortArrays ===> ", sortArrays)
//     if(sortArrays.length > 0){
//       const sortOrder = sortArrays[0].deviceIdArr || []
//       filteredColls.sort( (a, b) => {
//         const indexA = sortOrder.indexOf(a);
//         const indexB = sortOrder.indexOf(b);
//         if(indexA === -1 && indexB === -1) return 0;
//         if(indexA === -1) return 1;
//         if(indexB === -1) return -1;
//         return indexA - indexB;
//       });
//     }
    
//     //=== 3.) จับข้อมูลอุปกรณ์ทั้งหมด
//     const coll_devices = db.collection(global.dbColl_devices)
//     const dataDevices = await coll_devices.find(
//       {},
//       { projection: { 
//           _id:0, 
//           deviceId:1,
//           deviceName:1,
//           deviceBgClassColor:1
//         } 
//       }
//     ).toArray()
//     // console.log("dataDevices ===> ", dataDevices)

//     res.send(JSON.stringify({
//       isGet : true,
//       class : "green",
//       dataDevices: dataDevices,
//       msg: `เรียงลำดับอุปกรณ์เรียบร้อยแล้ว` ,
//     }))

//     // const html = await myModule.renderView("dashboard", res, {
//     //   title: PAGE_DASHBOARD,
//     //   time : myDateTime.getDate(),
//     //   msg: req.flash('msg'),
//     //   user, 
//     //   settings : await myModule.getSettings(),
      
//     //   dataDevices,
//     //   dataAll,
//     //   deviceIds,
//     //   count_alert,

//     //   PATH_REPORT,
//     //   PATH_DATA_BY_ID,
//     //   // PATH_GET_ALERTS
//     // })
//     // res.send(html)
//   }catch(err){
//     console.log(err)
//     res.status(404).sendFile(file404)
//   }finally{
//     client.close()
//   }

// })




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