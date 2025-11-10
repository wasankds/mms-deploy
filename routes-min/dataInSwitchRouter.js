// import { DateTime } from 'luxon'
// import multer from 'multer'
// import path from 'path'
// import fs from 'fs'
// import * as myUsers from "../mymodule/myUsers.js"
// import * as myModule from "../mymodule/myModule.js"
// import mainAuth from "../middleware/mainAuth.js" 
// const PATH_MAIN = '/user'
// // const PATH_SAVE = `/manage/users/save` // ใช้ร่วมกับ manageUsersRouter
// const PATH_SAVE = `${PATH_MAIN}/save`
// const PATH_CHANGE_PASSWORD = `${PATH_MAIN}/change-password`  
// const PATH_UPLOAD = `${PATH_MAIN}/upload`
// const SIGNATURE_SUFFIX = "_SIGNATURE"
// import { MongoClient } from 'mongodb'
// import * as myDateTime from "../mymodule/myDateTime.js"
// import * as myData from "../mymodule/myData.js"
import express from 'express'
const router = express.Router()
const myDateTime = await import(`../${mymoduleFolder}/myDateTime.js`)
const myData = await import(`../${mymoduleFolder}/myData.js`)


//=======================================================
// 
// *** สำหรับรับข้อมูลจาก esp32 ,***
// - รับมาแสดงเท่านั้น ไม่ได้เก็บลงฐานข้อมูล ยกเว้ยครั้งแรกเท่านั้น
// 
// รับ path ที่ขึ้นต้นด้วย s เช่น /s001, /s002
// - เช่น http://localhost/s005?h=75&t=35&key=7127000
//       http://localhost:80/s001
// 
//       https://mms.wasankds.com/e001
// 
// ใช้จริง ถ้ากดปิด/เปิดจากสวิทต์ที่ ESP32 อาจเปิด/ปิด 2 ครั้ง
// - เพราะตอนกดสวิตท์ ส่งมาอัปเดทข้อมูล 1 ครั้ ซึ่งใช้เวลาบ้าง
//   ขื้อมูลที่ส่งมาจาก ESP อาจ Lap กันนิดนึงทำให้ผิดพลาด อาจเปิด/ปิด 2 ครั้ง - 
//   *** ต้อง ทำอะไรกับข้อมูลตอนส่งมาด้วย ***
// 
// 
router.post(/^\/s\d{3}$/, async (req, res) => {
  // console.log(`-----------------${req.path}----------------------`)
  // console.log("req.body ===> " , req.body)
  // req.body ===>  { id: 's001', s1: '0', s2: '0', action: 'send', key: '0813996766' }

  //=== 1.) ตรวจสอบ key ก่อน
  if(!global.SYS_KEYS_SWITCH.includes(req.body.key)){
    return res.status(403).send({ status : 'error', msg: 'Forbidden' });
  }
  const { id: deviceId, action } = req.body
  delete req.body.key
  delete req.body.action

  const timestamp = myDateTime.now()
  req.body.timestamp = timestamp

  //=== 1.1) อัปเดทข้อมูลใน global.SWITCHES ด้วย
  if(action === 'send'){                 // ส่งข้อมูลปกติ
    const device = myData.getDeviceById(deviceId)
    if(!device){ 
      myData.updateSwitchesData(req.body)
    }
  }else if(action === 'press'){          // กดปุ่มที่ esp32
    myData.updateSwitchesData(req.body)
  }else if(action === 'press-web'){      // กดปุ่มบนเว็บ
    myData.updateSwitchesData(req.body)
  }else{
    return res.status(400).send({ status : 'error', msg: 'Bad Request' });
  }
  // console.log("global.SWITCHES ===> " , global.SWITCHES);

  //=== 2.) 
  // - จับเฉพาะคีย์ที่ขึ้นต้นด้วย s และค่าออกมา เช่น { s1: '1', s2: '0' } 
  const device = myData.getDeviceById(deviceId)
  // console.log("device ===> " , device);

  const rtnObj = {}
  Object.keys(device).forEach(key => {
    if(key.startsWith('s')){ // && key.length == 2
      rtnObj[key] = (!isNaN(device[key]) && device[key] !== '') ? Number(device[key]) : device[key]
    }
  })

  //=== 3.) คืนค่าไปยังอุปกรณ์
  // - กดจากหน้าเว็บ
  if(action === 'press-web'){
    res.send(JSON.stringify({
      isStatus : true,
      class : "green",
      msg:`อัปเดตสถานะสวิตช์เรียบร้อยแล้ว` ,
      id : deviceId, 
    }))
  }
  // ส่งข้อมูลปกติ / กดจาก esp32
  else{
    res.status(200).send(rtnObj)
  }
  
  //=== 3.) Boardcast - ต้องมี id และ timestamp ด้วย
  // const device = myData.getDeviceById(deviceId)
  // console.log("device1 ===> " , device);
  //  { id: 's001', s1: '1', s2: '1', timestamp: '2025-09-18 11:30:25' }
  // req.io.emit(deviceId,  device); 
  req.io.emit(deviceId,  device); 

  // delete device.id
  // delete device.timestamp
  // console.log("device2 ===> " , device); // { s1: '1', s2: '1' }
  // return res.status(200).send(device)

  // //=== 4.) เขียนลงฐานข้อมูล
  // const client = new MongoClient(global.dbUrl)
  // setImmediate( async () => {
  //   try{

  //     // console.log("device ===> " , device);

  //     // await client.connect()
  //     // const db = client.db(global.dbName)
  //     // const collection = db.collection(deviceId)      

  //     // // === 4.1) ถ้ามีเอกสารเดิม - ไม่ต้องทำอะไร    
  //     // const existingDoc = await collection.findOne({ id: deviceId });
  //     // if (existingDoc) {
  //     //   // ต้องอัปเดทข้อมูลในฐานข้อมูลด้วย
  //     //   var rtn = existingDoc
  //     //   // rtn.timestamp = timestamp  // ส่งเวลาปัจจุบัน ไปด้วย - แต่ไม่ต้องอัปเดทในฐานข้อมูล
  //     // }
  //     // //=== 4.2) ถ้าไม่มีเอกสารเดิม - insert ใหม่
  //     // else {
  //     //   // แปลง req.body ให้เป็นตัวเลข - และแปลง type เป็น Number ถ้าเป็นตัวเลข
  //     //   const data = Object.entries(req.body)
  //     //                     .filter(([key]) => key !== 'id') //  && key.length == 2
  //     //                     .map(([key, value]) => ({
  //     //                       // id: deviceId,
  //     //                       key,
  //     //                       value: (!isNaN(value) && value !== '') ? Number(value) : value
  //     //                     }));
  //     //   const dataToWrite = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
  //     //   const newDoc = {
  //     //     id: deviceId, 
  //     //     timestamp: timestamp,
  //     //     key : 'sw', // เพิ่ม key sw เพื่อให้ client รู้ว่าเป็นสวิตช์
  //     //     ...dataToWrite,
  //     //   };
  //     //   const rtnInsert = await collection.insertOne(newDoc);
  //     //   if(rtnInsert.acknowledged && rtnInsert.insertedId){
  //     //     var rtn = newDoc;
  //     //   }else{
  //     //     return res.status(500).send({ status : 'error', msg: 'Insert document failed' });
  //     //   }

  //     //   //=== ส่งข้อมูลไปยัง client ที่เชื่อมต่อผ่าน socket.io
  //     //   delete rtn._id
  //     //   delete rtn.key
  //     //   req.io.emit(deviceId, rtn);
  //     // }    
  //     // // console.log("device ===> " , device);

  //   }catch(error){
  //     console.log(error)
  //     res.status(500).send({ status : 'error', msg: error.message });
  //   }finally{
  //     await client.close()
  //   }
  // }); // setImmediate
});

export default router




// //== 4.0) ตรวจสอบว่ามีการเปลี่ยนแปลงข้อมูลหรือไม่
// // - ข้อมูลจาก ESP32 และ ข้อมูลในฐานข้อมูล
// const needsUpdate = Object.entries(dataToWrite).some(([key, value]) => {
//   return existingDoc[key] != value
// });
// // console.log("needsUpdate ===> " , needsUpdate);

// //== 4.1 - ตรงกันไม่ต้องอัปเดทอะไร
// if (!needsUpdate) { 
//   var rtn = existingDoc; 
// }
// //== 4.2
// else{
//   // await collection.findOneAndUpdate(
//   //   { id: id },
//   //   {
//   //     $set: {
//   //       // ...dataToWrite, //               
//   //       timestamp: timestamp,     
//   //       key : 'sw', // เพิ่ม key sw เพื่อให้ client รู้ว่าเป็นสวิตช์       
//   //     },
//   //   }, 
//   //   // คืนค่าเอกสารหลังอัปเดท และ ไม่สร้างใหม่ถ้าไม่มี
//   //   // { returnDocument: 'after', upsert: false }
//   // );
  
//   var rtn = existingDoc
//   // console.log("rtn.dataToWrite ===> " , rtn); 
// }







// ****** ไม่มีก็ได้ ใช้ตอนกดสวิต์ทที่ esp32 แทน เพื่อสร้างข้อมูลใหม่ ******
// //=== 4.2) ถ้าไม่มีเอกสารเดิม - insert ใหม่
// else {
//   // แปลง req.body ให้เป็นตัวเลข - และแปลง type เป็น Number ถ้าเป็นตัวเลข
//   const data = Object.entries(req.body)
//                     .filter(([key]) => key !== 'id') //  && key.length == 2
//                     .map(([key, value]) => ({
//                       // id: deviceId,
//                       key,
//                       value: (!isNaN(value) && value !== '') ? Number(value) : value
//                     }));
//   const dataToWrite = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})
//   const timestamp = myDateTime.now()
//   const newDoc = {
//     id: deviceId, 
//     timestamp: timestamp,
//     key : 'sw',         // เพิ่ม key sw เพื่อให้ client รู้ว่าเป็นสวิตช์
//     ...dataToWrite,
//   };
//   const rtnInsert = await collection.insertOne(newDoc);
//   if(rtnInsert.acknowledged && rtnInsert.insertedId){
//     var rtn = newDoc;
//   }else{
//     return res.status(500).send({ status : 'error', msg: 'Insert document failed' });
//   }
// }    


  // switchData.forEach( async (obj,i) => {
  //   // console.log("obj ===> " ,i , obj);
  //   await myData.updateSwitches(deviceId, obj.key, obj.value)
  // });
  // console.log("global.SWITCHES ===> " , global.SWITCHES);
  //  [
  //   { s1: 0, s2: 0 },
  //   { id: 's001', timestamp: '2025-09-18 09:36:46', s1: 0, s2: 0 }
  // ]










// //=======================================================
// // - เมื่อกดสวิทต์ที่ ESP32 ให้ส่งข้อมูลมาที่ path นี้
// //  POST /sXXX/press
// // *****
// // จับใส่ตัวแปร Global ไว้ด้วย ก่อนเขียนลงฐานข้อมูล จะเร็วกว่ารอ rtn จากฐานข้อมูล
// // **** 
// // 
// router.post(/^\/s\d{3}\/press$/, async (req, res) => {
//   console.log(`-----------------${req.path}------/----------------`)
//   console.log("req.body ===> " , req.body)
//   // req.body ===>  { key: '0813996766', id: 's001', s1: 1, s2: 0 }
  
//   //=== 1.) ตรวจสอบ key ก่อน
//   if(req.body.key != '0813996766'){
//     return res.status(403).send({ status : 'error', msg: 'Forbidden' });
//   }
//   delete req.body.key

//   const { id: deviceId } = req.body
//   delete req.body.id
//   delete req.body.action

//   //=== 2.) จับ key ที่ขึ้นต้นด้วย s ใส่ใน global.SWITCHES ด้วย
//   const switchKeys = Object.keys(req.body).filter(key => key.startsWith('s'));
//   const switchData = switchKeys.map(key => ({
//     key,
//     value: (!isNaN(req.body[key]) && req.body[key] !== '') ? Number(req.body[key]) : req.body[key]
//   }));
//   switchData.forEach( obj => {
//     myData.updateSwitches(deviceId, obj.key, obj.value)
//   }); 

  
//   //=== 3.) ส่งกลับไปที่ ESP32 ทันที ไม่ต้องรอเขียนฐานข้อมูล
//   res.status(200).send(dataToWrite);

//   //=== 4.) ทำงานกับฐานข้อมูลแบบ async ต่อได้
//   // setImmediate - ใช้กับงานเบื้องหลัง เช่น update database
//   const client = new MongoClient(global.dbUrl)
//   setImmediate( async () => {
//     try {

//       //=== 2.) แปลง req.body ให้เป็นตัวเลข
//       // - และแปลง type เป็น Number ถ้าเป็นตัวเลข
//       const data = Object.entries(req.body)
//                           .filter(([key]) => key !== 'id') //  && key.length == 2
//                           .map(([key, value]) => ({
//                             key,
//                             value: (!isNaN(value) && value !== '') ? Number(value) : value
//                           }));
//       const dataToWrite = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})

//       //== 4.1) เขียนลงฐานข้อมูล
//       await client.connect()
//       const db = client.db(global.dbName)

//       //== 4.2) ค้นหาก่อน
//       const existingDoc = await db.collection(deviceId).findOne({});
//       if(!existingDoc){ 
//         //= 4.2.1) ถ้าไม่มีเอกสารเดิม - เพื่อข้อมูล
//         var rtn = await db.collection(deviceId).insertOne({
//           id: deviceId,
//           timestamp: myDateTime.now(),
//           ...dataToWrite,
//           key : 'sw', // เพิ่ม key sw เพื่อให้ client รู้ว่าเป็นสวิตช์
//         });
//       }else{ 
//         //= 4.2.2) ถ้ามีเอกสารเดิม
//         var rtn = await db.collection(deviceId).findOneAndUpdate(
//           {} ,
//           {
//             $set: {
//               ...dataToWrite, //
//               timestamp: myDateTime.now(),
//             }
//           },
//           { returnDocument: 'after', upsert: false }
//         );
//       }

//       //== 4.3) ส่งข้อมูลไปยัง client ที่เชื่อมต่อผ่าน socket.io
//       delete rtn._id
//       delete rtn.key

//       // console.log("rtn ===> " , rtn);
//       // { id: 's001', timestamp: '2025-09-17 16:36:28', s1: 1, s2: 1 }
//       req.io.emit(deviceId, rtn);
//     }catch(err){
//       console.log(err)
//       res.status(500).send({ status : 'error', msg: err.message });
//     }finally{
//       client.close()
//     }

//   }); // setImmediate
// });