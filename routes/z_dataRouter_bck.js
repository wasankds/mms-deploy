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
// *** สำหรับรับข้อมูลจาก esp32 ***
// 
// รับ path ที่ขึ้นต้นด้วย e เช่น /e001, /e002
// - เช่น http://localhost/e005?h=75&t=35&key=7127000
//       http://localhost:80/e001
// 
//       https://mms.wasankds.com/e001
// 
router.post(/^\/e\d{3}$/, async (req, res) => {
  // console.log(`-----------------${req.path}----------------------`)
  // console.log("req.body ===> " , req.body)
  // req.body ===>  { t: 34.2, h: 66, id: 'e001' }
  
  const { id } = req.body
  const client = new MongoClient(global.dbUrl)

  try{

    //=== 1.) ตรวจสอบ key ก่อน
    if(req.body.key != '7127000'){
      return res.status(403).send({ status : 'error', msg: 'Forbidden' });
    }
    delete req.body.key

    //=== 2.) แปลง req.body ให้เป็นตัวเลข
    // - และแปลง type เป็น Number ถ้าเป็นตัวเลข
    const data = Object.entries(req.body)
      .filter(([key]) => key !== 'id' && key.length == 1)
      .map(([key, value]) => ({
        id: req.body.id,
        key,
        value: (!isNaN(value) && value !== '') ? Number(value) : value
      }));

    //=== 3.) ปรับ timeInterval ให้ลงตัวรอบ 10 นาที (เช่น 13:57 -> 13:50)
    const timestamp = myDateTime.now()
    const timeInterval = timestamp.substring(0, 15) + '0';

    // // สำหรับทดสอบเฉยๆ
    // return res.status(200).json({ message: 'ok' });

    //=== เขียนลงฐานข้อมูล
    await client.connect()
    const db = client.db(global.dbName)
    const collection = db.collection(id)

    //=== 4.) บันทึกข้อมูลทีละ key
    for (const { key, value } of data) {
      const filter = { key: key, timeInterval: timeInterval };    
      
      // 4.1) ค้นหาเอกสารเดิมก่อน - ถ้ามีให้ update
      const existingDoc = await collection.findOne(filter);
      if (existingDoc) {
        var rtn = await collection.findOneAndUpdate(
          filter,
          { $set: {
              max: Math.max(existingDoc.max, value),
              min: Math.min(existingDoc.min, value),
              avg: parseFloat(((existingDoc.avg * existingDoc.count + value) / (existingDoc.count + 1)).toFixed(2)),
            },
            $inc: { count: 1 },
          },
          // คืนค่าเอกสารหลังอัปเดท และ ไม่สร้างใหม่ถ้าไม่มี
          { returnDocument: 'after', upsert: false } 
        );        
      } 
      // 4.2) ถ้าไม่มีเอกสารเดิม ให้ insert ใหม่
      else {
        const newDoc = {
          id: id, 
          key: key, 
          timeInterval: timeInterval,
          min: value, 
          max: value, 
          avg: value, 
          count: 1,
        };
        const rtnInsert = await collection.insertOne(newDoc);
        if(rtnInsert.acknowledged && rtnInsert.insertedId){
          rtn = newDoc;
          // }else{console.log('Insert not acknowledged or no insertedId');
        }
      }

      //=== ส่งข้อมูลไปยัง client ที่เชื่อมต่อผ่าน socket.io
      rtn.lastValue = value      // ส่งค่าล่าสุด    ไปด้วย
      rtn.timestamp = timestamp  // ส่งเวลาปัจจุบัน ไปด้วย
      req.io.emit(id, rtn);
    } // for
    
    return res.status(200).send({ status : 'ok', msg: 'I have got your data'});
  }catch(error){
    console.log(error)
    res.status(500).send({ status : 'error', msg: error.message });
  }finally{
    await client.close()
  }
});

export default router

