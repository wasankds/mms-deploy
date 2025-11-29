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
const myData = await import(`../${mymoduleFolder}/myData.js`)
const PATH_MAIN = '/devices-sorting'
const PATH_SAVE = `${PATH_MAIN}/save`


//================================================================
// 
// 
router.get(PATH_MAIN, mainAuth.isAuth , async (req, res) => {
  const client = new MongoClient(global.dbUrl)
  try{
    await client.connect()
    const db = client.db(global.dbName)
    const user = await myUsers.getSessionData(req) ;

    //=== 1.) จับข้อมูลอุปกรณ์ทั้งหมด - สำหรับ lookup ชื่ออุปกรณ์/สีอุปกรณ์
    // - จับข้อมูลแบบ Lightweight ระบุเป็น step=1
    const devices = await myData.getDataDevices(1)
    devices.forEach(element => delete element.triggerRows );
    console.log('devices ===> ', devices)

    //=== 2.) เรียงตามอาเรย์ devicesRow ที่ใช้เรียงลำดับ ถ้ามีในอาเรย์นี้
    // - ดึง sortArrays จากฐานข้อมูล
    const coll_devicesSorting = db.collection(global.dbColl_deviceSorting)
    const devicesSorting_ByUserId = await coll_devicesSorting.findOne(
      { userId : user.userId  }, // ค้นหาตาม userId ที่ล็อกอินอยู่
      { projection: { _id:0 } }
    )
    console.log('devicesSorting_ByUserId ===> ', devicesSorting_ByUserId)

    if(devicesSorting_ByUserId){
      const devicesRow = devicesSorting_ByUserId.devicesRow || []
      // - อะไรที่ไม่มีในอาเรย์ devicesRow ให้เอาไว้ บนสุด
      devices.sort( (a, b) => {
        const indexA = devicesRow.findIndex(row => row.deviceId === a.deviceId);
        const indexB = devicesRow.findIndex(row => row.deviceId === b.deviceId);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return -1;
        if (indexB === -1) return 1;
        return indexA - indexB;
      });
    }
    console.log('devices after sorting ===> ', devices)

    //=== 3.) จับค่า devicesRow จาก devicesSorting_ByUserId ไปให้ dataDevices
    const dataDevices = devices.map( deviceInfo => {
      let deviceShow = '';
      if (devicesSorting_ByUserId) {
        const foundRow = devicesSorting_ByUserId.devicesRow.find(row => row.deviceId === deviceInfo.deviceId);
        if (foundRow) {
          deviceShow = foundRow.deviceShow;
        }
      }
      return {
        deviceId: deviceInfo.deviceId,       // 1
        deviceName: deviceInfo.deviceName,   // 2
        deviceBgClassColor: deviceInfo.deviceBgClassColor,   // 3
        deviceShow: deviceShow,              // 4
      }
    })
    console.log('dataDevices ===> ', dataDevices)

    //=== 4.) Render View
    const html = await myModule.renderView("devicesSorting", res, {
      title: PAGE_DEVICES_SORTING,
      time : myDateTime.getDate(),
      msg: req.flash('msg'),
      user, 
      
      data : dataDevices,
      PATH_MAIN,
      PATH_SAVE,
    })
    res.send(html)
  }catch(err){
    console.log(err)
    res.status(404).sendFile(file404)
  }finally{
    client.close()
  }

})


//=======================================================
// แยกยูสเซอร์
// 
router.post(PATH_SAVE, mainAuth.isAuth, async (req, res) => {
  // console.log(`-----------------${req.originalUrl}------------------`)
  // console.log("req.body ===> " , req.body)
  // req.body ===>  {
  //   deviceSortingRow: [
  //     { deviceId: 'e001', deviceShow: 1 },
  //     { deviceId: 'e002', deviceShow: 1 },
  //     { deviceId: 'e003', deviceShow: 1 },
  //     { deviceId: 'e004', deviceShow: 1 },
  //     { deviceId: 'e100', deviceShow: 1 }
  //   ]
  // }

  const client = new MongoClient(global.dbUrl)
  try {

    const { devicesRow } = req.body
    const user = await myUsers.getSessionData(req)

    await client.connect()
    const db = client.db(global.dbName)
    const coll_deviceSorting = db.collection(global.dbColl_deviceSorting)

    //=== ข้อมูลที่บันทึกหรืออัปเดต
    const data = {
      userId: user.userId,
      devicesRow: devicesRow,
    }

    //=== ค้นหาตาม userId ถ้ามีให้ทำการอัปเดต ถ้าไม่มีให้เพิ่มใหม่
    const rtnUpdate = await coll_deviceSorting.updateOne(
      { userId: user.userId },
      { $set: data },
      { upsert: true }
    )

    //== Return
    if (rtnUpdate.acknowledged && rtnUpdate.modifiedCount > 0) {
      res.send(JSON.stringify({
        isSave: true,
        class: "green",
        msg: `บันทึกข้อมูลเรียบร้อยแล้ว`,
      }))
    } else if (rtnUpdate.acknowledged && rtnUpdate.upsertedCount > 0) {
      res.send(JSON.stringify({
        isSave: true,
        class: "green",
        msg: `บันทึกข้อมูลเรียบร้อยแล้ว{{sep}}[เพิ่มใหม่]`,
      }))  
    } else if (rtnUpdate.acknowledged && rtnUpdate.modifiedCount ==  0 && rtnUpdate.upsertedCount == 0) {
      res.send(JSON.stringify({
        isSave: true,
        class: "yellow",
        msg: `ไม่มีการเปลี่ยนแปลง`,
      }))  
    } else {
      res.send(JSON.stringify({
        isSave: false,
        class: "red",
        msg: `ไม่สามารถบันทึกข้อมูลได้`,
      }))
    }
  } catch (err) {
    console.log("error ===> ", err);
    res.send(JSON.stringify({
      isSave: false,
      class: "red",
      msg: err.message,
    }))  
  } finally {
    client.close()
  }

})



export default router


