/* import XLSX from "xlsx" */
// import ejs from 'ejs'
// import path from 'path'
// import fs from 'fs'
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
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const PATH_MAIN = '/dashboard'
const PATH_DATA_BY_ID = `/data` // ดูข้อมูลรายตัว
const PATH_REPORT = `/report`
const PATH_DEVICES_SORTING = `/devices-sorting`

//================================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isAuth , async (req, res) => {
  console.log(`-----------------${req.originalUrl}------------------`) 
  console.log(req.query)

  const client = new MongoClient(global.dbUrl)
  try{
    const user = myUsers.getSessionData(req)

    await client.connect()
    const db = client.db(global.dbName)

    //=== 1.) จับชื่อ collections ที่ขึ้นต้นด้วย e ตามด้วยตัวเลข 3 ตัว
    // - นับจำนวนเอกสารในแต่ละ collection ที่กรองมา
    // - ถ้า Collection ไม่มี document ให้ลบ Collection นั้นทิ้ง
    const collName_of_devices = await db.listCollections().toArray()
    collName_of_devices.sort( (a, b) => a.name.localeCompare(b.name) ) 
    const filteredColls = collName_of_devices.map(coll => coll.name).filter(name => /^e\d{3}$/.test(name));
    for (const collName of filteredColls) {
      const count = await db.collection(collName).countDocuments();
      if (count === 0) {
        await db.collection(collName).drop();
        // หลัง drop() ลบชื่อ collection ออกจาก filteredColls
        const index = filteredColls.indexOf(collName);
        if (index > -1) {
          filteredColls.splice(index, 1);
        }
      }
    }

    //=== 2.) เรียงตามอาเรย์ sortArrays ถ้ามีในอาเรย์นี้
    // - ดึง sortArrays จากฐานข้อมูล
    const coll_devicesSorting = db.collection(global.dbColl_deviceSorting)
    const devicesSortingByUserId = await coll_devicesSorting.findOne(
      { userId : user.userId  },
      { projection: { _id:0 } }
    )
    if(devicesSortingByUserId){
      const devicesSortingRows = devicesSortingByUserId.devicesSortingRows || []
      // - อะไรที่ไม่มีในอาเรย์ devicesSortingRows ให้เอาไว้ บนสุด
      filteredColls.sort( (a, b) => {
        const indexA = devicesSortingRows.indexOf(a);
        const indexB = devicesSortingRows.indexOf(b);
        if(indexA === -1 && indexB === -1) return 0;
        if(indexA === -1) return -1;
        if(indexB === -1) return 1;
        return indexA - indexB;
      });
    }

    //=== 3.) จับข้อมูลอุปกรณ์ทั้งหมด - สำหรับ lookup ชื่ออุปกรณ์/สีอุปกรณ์
    const coll_devices = db.collection(global.dbColl_devices)
    const dataDevices = await coll_devices.find(
      {},
      { projection: { _id:0, changesHistory:0 } }
    ).toArray()
    // console.log("dataDevices ===> ", dataDevices)

    //=== 4.) จับข้อมูลในคอลเล็กชั่น e ทั้งหมด ในช่วง 10 นาทีล่าสุด มาแสดงใน dashboard
    // - ถ้าไม่ขึ้นแสดงว่า ไม่มีข้อมูลในช่วง 10 นาทีล่าสุดของอุปกรณ์นั้น - อุปกรณ์อาจเสีย
    // - find ข้อมูลเพิ่มเติมจาก dataDevices
    const nowInTenMinute = myDateTime.now().substring(0, 15) + '0'; // 2025-10-24 09:00
    const dataPromises = filteredColls.map(async (collName) => {
      const doc = await db.collection(collName)
                          .find({ timeInterval: nowInTenMinute })
                          .project({ _id: 0 })
                          .toArray();
      return { 
        deviceId : collName,
        deviceName : (dataDevices.find(obj => obj.deviceId === collName)?.deviceName) || '-', // ชื่อ esp32
        deviceBgClassColor : (dataDevices.find(obj => obj.deviceId === collName)?.deviceBgClassColor) || 'bg-ligray', // สี esp32
        data: doc
      };
    });
    const dataAll = await Promise.all(dataPromises);
    // console.log("dataAll ===> ", dataAll[0].data)


    //=== 5) เพิ่ม keyName/keyUnit ให้กับแต่ละ key ใน dataAll
    // - และจัด format min, max, avg ให้เป็นทศนิยม 2 ตำแหน่ง
    // - KEYS_DEFINITION จับจากฐานข้อมูลใส่ตัวแปล global.KEYS_DEFINITION แล้วตั้งแต่เปิดระบบ
    dataAll.forEach(item => {
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

    //=== 6.) จับค่า unique id จาก data ทั้งหมด - ของจริงให้จับจาก Devices Settings
    const deviceIds = dataAll.map(item => item.deviceId);

    //=== 7.) นับ alert ที่ยังไม่อ่าน - เฉพาะของ user นี้ (ทุกอุปกรณ์)
    const coll_alerts = db.collection(global.dbColl_alerts)
    const count_alert = await coll_alerts.countDocuments({ 
      $or: [
        { readRows: { $exists: false } },
        { readRows: { $not: { $elemMatch: { userId: user.userId } } } }
      ]
    });

    //=== 8.) Render View
    const html = await myModule.renderView("dashboard", res, {
      title: PAGE_DASHBOARD,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user, 
      settings : await myModule.getSettings(),
      
      dataDevices,
      dataAll,
      deviceIds,
      count_alert,

      PATH_REPORT,
      PATH_DATA_BY_ID,
      PATH_DEVICES_SORTING,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})


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