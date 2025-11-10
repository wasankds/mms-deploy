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
import express from 'express'
const router = express.Router()
import { MongoClient } from 'mongodb'
import * as myDateTime from "../mymodule/myDateTime.js"




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
  
  const { id: deviceId } = req.body
  delete req.body.action

  const client = new MongoClient(global.dbUrl)
  try{

    //=== 1.) ตรวจสอบ key ก่อน
    if(req.body.key != '0813996766'){
      return res.status(403).send({ status : 'error', msg: 'Forbidden' });
    }
    delete req.body.key

    //=== ดึงข้อมูลมาตรวจสอบ 
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(deviceId)
    const timestamp = myDateTime.now()
    

    //=== ตรวจสอบค่า sxx ที่ส่งมา(req.body) กับ existingDoc
    // - ถ้าไม่ตรงกัน



    // 
    // const data = Object.entries(req.body)
    //                     .filter(([key]) => key.startsWith('s')) //  && key.length == 2
    //                     .map(([key, value]) => ({
    //                       key,
    //                       value: (!isNaN(value) && value !== '') ? Number(value) : value
    //                     }));
    

    //=== 4.1) ถ้ามีเอกสารเดิม - ไม่ต้องทำอะไร
    const existingDoc = await collection.findOne({ id: deviceId });
    if (existingDoc) {
      // ต้องอัปเดทข้อมูลในฐานข้อมูลด้วย
      var rtn = existingDoc
      rtn.timestamp = timestamp  // ส่งเวลาปัจจุบัน ไปด้วย -
    } 
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

    //=== ส่งข้อมูลไปยัง client ที่เชื่อมต่อผ่าน socket.io
    delete rtn._id
    delete rtn.key
    req.io.emit(deviceId, rtn);
    
    //=== ส่งกลับไปที่ ESP32 === ส่งแค่คีย์ที่ขึ้นต้นด้วย s เท่านั้น
    delete rtn.id
    delete rtn.timestamp
    // console.log("rtn ===> " , rtn);
    return res.status(200).send(rtn);
  }catch(error){
    console.log(error)
    res.status(500).send({ status : 'error', msg: error.message });
  }finally{
    await client.close()
  }
});


//=======================================================
// - เมื่อกดสวิทต์ที่ ESP32 ให้ส่งข้อมูลมาที่ path นี้
//  POST /sXXX/press
// *****
// จับใส่ตัวแปร Global ไว้ด้วย ก่อนเขียนลงฐานข้อมูล จะเร็วกว่ารอ rtn จากฐานข้อมูล
// **** 
// 
router.post(/^\/s\d{3}\/press$/, async (req, res) => {
  // console.log(`-----------------${req.path}----------------------`)
  // console.log("req.body ===> " , req.body)

  const { id: deviceId } = req.body
  delete req.body.id
  delete req.body.action

  const client = new MongoClient(global.dbUrl)
  try{

    //=== 1.) ตรวจสอบ key ก่อน
    if(req.body.key != '0813996766'){
      return res.status(403).send({ status : 'error', msg: 'Forbidden' });
    }
    delete req.body.key

    //=== 2.) แปลง req.body ให้เป็นตัวเลข
    // - และแปลง type เป็น Number ถ้าเป็นตัวเลข
    const data = Object.entries(req.body)
                       .filter(([key]) => key !== 'id') //  && key.length == 2
                       .map(([key, value]) => ({
                         key,
                         value: (!isNaN(value) && value !== '') ? Number(value) : value
                       }));
    const dataToWrite = data.reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {})

    //=== เขียนลง global.SWITCHES ไว้เพื่อความรวดเร็ว แล้วส่งตัวนี้ไปให้ client ทันที
    global.SWITCHES[deviceId] = global.SWITCHES[deviceId] || {};
    
    //=== 3.) เขียนลงฐานข้อมูล
    await client.connect()
    const db = client.db(global.dbName)

    //=== 3.) ค้นหาก่อน
    const existingDoc = await db.collection(deviceId).findOne({});
    if(!existingDoc){ 
      //== 3.1) ถ้าไม่มีเอกสารเดิม - เพื่อข้อมูล
      var rtn = await db.collection(deviceId).insertOne({
        id: deviceId,
        timestamp: myDateTime.now(),
        ...dataToWrite,
        key : 'sw', // เพิ่ม key sw เพื่อให้ client รู้ว่าเป็นสวิตช์
      });
    }else{ 
      //== 3.2) ถ้ามีเอกสารเดิม
      var rtn = await db.collection(deviceId).findOneAndUpdate(
        {} ,
        {
          $set: {
            ...dataToWrite, //
            timestamp: myDateTime.now(),
          }
        },
        { returnDocument: 'after', upsert: false }
      );
    }

    //=== 4.) ส่งข้อมูลไปยัง client ที่เชื่อมต่อผ่าน socket.io
    delete rtn._id
    delete rtn.key
    req.io.emit(deviceId, rtn);

    //=== 5.) ส่งกลับไปที่ ESP32 === ส่งแค่คีย์ที่ขึ้นต้นด้วย s เท่านั้น
    // - ลบทุกคีย์ใน rtn ที่ไม่ใช่ sxx ออก
    Object.keys(rtn).forEach(key => {
      if(!key.startsWith('s')){
        delete rtn[key]
      }
    });
    return res.status(200).send(rtn)
  }catch(err){
    console.log(err)
    res.status(500).send({ status : 'error', msg: err.message });
  }finally{
    client.close()
  }

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
