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
// const PATH_REPORT = `/report`
// const PATH_PRINT = `${PATH_MAIN}/print`
// const PATH_VIEW = `${PATH_MAIN}/view`
// const PATH_SAVE = `${PATH_MAIN}/save`
// const PATH_DELETE = `${PATH_MAIN}/delete`
// const PATH_FETCH = `${PATH_MAIN}/fetch`
// const PREFIX = PATH_MAIN.replace(/\//g,"_") 
import express from 'express' ;
const router = express.Router() ; 
import { MongoClient } from 'mongodb'
import mainAuth from "../middleware/mainAuth.js"
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myUsers = await import(`../${mymoduleFolder}/myUsers.js`)
const myModule = await import(`../${mymoduleFolder}/myModule.js`)
const PATH_MAIN = '/dashboard-switch'
const PATH_STATUS = `${PATH_MAIN}/status`


//================================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isO , async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`) 
  // console.log(req.query)

  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const coll_switches = db.collection('switches');  

    // //==== จับจาก global - จะว่างในตอนต้นสุด ต้องกดปุ่ม esp32 เพื่อสร้างข้อมูล
    // let dataAll = global.SWITCHES.map( obj => {
    //   const findKey = global.KEYS_DEFINITION.find( k => k.key === obj.key);
    //   return {
    //     id: obj.id,
    //     name : findKey ? findKey.keyName : obj.id,       // ชื่อ esp32- ถ้าไม่เจอให้แสดง id แทน
    //     bgColor : findKey ? findKey.bgColor : 'bg-gray', // สี esp32 - ถ้าไม่เจอให้แสดง bg-gray แทน
    //     ...obj
    //   }
    // })
    const coll_devices = db.collection(global.dbColl_devices)
    const dataDevices = await coll_devices.find(
      {}, 
      { projection: { _id: 0, triggerRows:0, changesHistory: 0 } }
    ).toArray();
    // console.log("dataDevices ===> " , dataDevices);


    let dataSwitches = await coll_switches.find({}, { projection: { _id: 0 } }).toArray();
    // console.log("dataSwitches ===> " , dataSwitches);

    dataSwitches = dataSwitches.map( obj => {     
      const findDevice = dataDevices.find( k => k.deviceId === obj.id);
      return {
        deviceId: obj.id,
        deviceName : findDevice ? findDevice.deviceName : obj.id, 
        deviceBgClassColor : findDevice ? findDevice.deviceBgClassColor : 'bg-ligray', // สี esp32 - ถ้าไม่เจอให้แสดง bg-gray แทน        
        ...obj
      }
    })

    //=== เพิ่ม keyName ให้กับแต่ละ key ใน dataAll
    // - และจัด format min, max, avg ให้เป็นทศนิยม 2 ตำแหน่ง
    dataSwitches = dataSwitches.map( obj => {      
      const switchKeys = Object.keys(obj).filter(k => k.startsWith('s') && !isNaN(k.substring(1)));

      const findKey = global.KEYS_DEFINITION.find( k => k.key === obj.key);
      const switchData = switchKeys.map( key => { 
        return { 
          key, 
          value: obj[key] ,
          keyName: findKey ? findKey.keyName : null,
          keyUnit: findKey ? findKey.keyUnit : null,
          bgColor: findKey ? findKey.bgColor : 'bg-ccc',
          fontColor: findKey ? findKey.fontColor : 'fc-black',
        } 
      });

      return {
        id: obj.id,
        deviceId: obj.deviceId,
        deviceName : obj.deviceName  , // name: 'สวิตช์1',
        deviceBgClassColor : obj.deviceBgClassColor ,  // bgColor: 'bg-mediumturquoise',
        switchData : switchData,
        // timestamp: obj.timestamp, // ไม่ได้ใช้
      };
    });
    // console.log("dataSwitches ===> ", dataSwitches)
    // return res.json(dataAll) // สำหรับทดสอบอย่างเดียว

    //=== จับค่า unique id จาก data ทั้งหมด
    const ids = dataSwitches.map(item => item.id); // ของจริงให้จับจาก Devices Settings
    // const dataDevices = global.DEVICES // ของจริงให้จับจาก Devices Settings

    const html = await myModule.renderView("dashboardSwitch", res, {
      title: PAGE_DASHBOARD_SWITCH,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user: await myUsers.getUserData(req),
      ...await myModule.getSettings(),
      
      PATH_STATUS,
      dataDevices,

      dataAll: dataSwitches,
      ids,
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





// //================================================================
// // คลิกปุ่มสวิตช์ที่หน้าเว็บ
// // - มาอัปเดทค่าที่ global.SWITCHES
// // 
// router.post(PATH_STATUS, mainAuth.isO , async (req, res) => {
//   console.log(`-----------------${req.originalUrl}------------------`) 
//   console.log(req.body)
//   // // { id: 's001', key: 's1', value: 0 }
//   // { deviceId: 's001', switchKey: 's1', switchValue: 0 }

//   // return res.send(JSON.stringify({
//   //   isStatus : true,
//   //   class : "green",
//   //   msg:`ok` ,
//   // }))

//   //=== อัปเดทค่าใน global.SWITCHES 
//   const { deviceId, switchKey, switchValue } = req.body
//   myData.updateSwitchesData({
//     id : deviceId, 
//     [switchKey]: switchValue  ,
//   })

//   console.log("global.SWITCHES ===> " , global.SWITCHES);

//   return res.send(JSON.stringify({
//     isStatus : true,
//     class : "green",
//     msg:`อัปเดตสถานะสวิตช์เรียบร้อยแล้ว` ,
//     id : deviceId, 
//     [switchKey]: switchValue  ,
//   })) 


//   // const client = new MongoClient(global.dbUrl)
//   // setImmediate( async () => {
//   //   try{
//   //     await client.connect()
//   //     const db = client.db(global.dbName)
      
//   //     // ใช้ findOneAndUpdate เพียงครั้งเดียว ลดเหลือ 1 transaction
//   //     const rtn = await db.collection(deviceId).findOneAndUpdate(
//   //       {},
//   //       {
//   //         $set: {
//   //           [switchKey]: switchValue,
//   //           timestamp: myDateTime.now(),
//   //         }
//   //         },
//   //       { returnDocument: 'after', upsert: true }
//   //     );
//   //     delete rtn._id
//   //     delete rtn.key

//   //     return res.send(JSON.stringify({
//   //       isStatus : true,
//   //       class : "green",
//   //       msg:`อัปเดตสถานะสวิตช์เรียบร้อยแล้ว` ,
//   //       ...rtn,
//   //     }))
//   //   }catch(err){
//   //     console.log(err)
//   //     return res.send(JSON.stringify({
//   //       isStatus : false,
//   //       class : "red",
//   //       msg: err.message ,
//   //     }))
//   //   }finally{
//   //     client.close()
//   //   }
//   // })

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














// //============================================
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


