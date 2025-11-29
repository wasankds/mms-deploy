
// import multer from 'multer';
// import fs from 'fs';
// import path from 'path';

import { DateTime  } from "luxon"

//=======
export function now() {
  return DateTime.now()
    .setZone('Asia/Bangkok')
    .toFormat('yyyy-MM-dd HH:mm:ss'); // คืนค่าเป็น string เช่น 2025-09-10 11:30
}

//=======
export function getDateTime(minutes=0) {
  return DateTime.now()
    .setZone('Asia/Bangkok')
    .plus({ minutes }) // เป็นเลขลบ ? ใช่
    .toFormat('yyyy-MM-dd HH:mm'); // คืนค่าเป็น string เช่น 2025-09-10 11:30
}

//=======
export function getDate(days=0) {
  return DateTime.now()
    .setZone('Asia/Bangkok')
    .plus({ days }) // เป็นเลขลบ ? ใช่
    .toFormat('yyyy-MM-dd'); // คืนค่าเป็น string เช่น 2025-09-10
}



//=========================================================
export function nowLocal() {  
  return DateTime.now()
    .setZone('Asia/Bangkok')
    .toISO(); // คืนค่าเป็น ISO string เช่น 2025-09-10T11:30:00+07:00
    //=== เก็บไว้ก่อน
    // const newDate = new Date();
    // const timezoneffsetMinuites = newDate.getTimezoneOffset() // -420 นาที (7 ชม.)
    // const timezoneffsetMs = timezoneffsetMinuites * 60000
    // const nowLocal = new Date(newDate.getTime() - timezoneffsetMs)
    // return nowLocal.toISOString();
}

//=========================================================
// luxon คืนค่าเวลา timezone ไทยเป็น Objectที่ตรงเวลาไทยไม่ได้
// ให้ใช้ตามโค้ดนี้แทน
// 
export function newDateTimeLocal(dateString) {
  if(dateString){
    var newDate = new Date(dateString)  
  }else{
    var newDate = new Date()
  }
  const timezoneffsetMinuites = newDate.getTimezoneOffset()  // -420 นาที (7 ชม.)
  const timezoneffsetMs = timezoneffsetMinuites*60000
  const newDateLocal = new Date(newDate.getTime()-timezoneffsetMs)
  return newDateLocal
}


//=======
// แปลงวันที่ไทยแบบเต็มเป็น ISO Date
// thaiDate เช่น  12 สิงหาคม 2568
export function format_ThaiDate_to_IsoDate(thaiDate) {
  const [day, monthName, year] = thaiDate.split(' ');
  const month = global.MONTH_NAMES.indexOf(monthName)+1;
  return `${year-543}-${String(month).padStart(2,'0')}-${String(day).padStart(2, '0')}`;
}

export function format_IsoDate_to_ThaiDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  const monthName = global.MONTH_NAMES[Number(month)-1];
  return `${day} ${monthName} ${Number(year)+543}`;
}

//============================================
//  คำนวณหาความต่างของวัน/เวลา 
// - dateTime1String วันที่และเวลาในรูปแบบเช่น 2025-09-10 11:30
// - dateTime2String วันที่และเวลาในรูปแบบเช่น 2025-09-10 11:30
// *** อะไรจะมากกว่ากันก็ได้ แล้วแต่ว่าต้องการตรวจสอบอะไร ****
//  
const aDayMs_ = 86400000  // milliseconds in a day
const anHourMs_ = 3600000 // milliseconds in an hour  
const aMinuteMs_ = 60000  // milliseconds in a minute
const aSecondMs_ = 1000   // milliseconds in a second
export function calc_DiffDateTime(dateTime1String, dateTime2String) {
  // console.log("================ calc_DiffDateTime ================")
  const dtNow = new Date(dateTime1String)
  const dtCheck = new Date(dateTime2String)
  
  const diffMs = dtCheck - dtNow // milliseconds // const diffMs = Math.abs(dtNow - dt2 ) // milliseconds
  const diffDays = Math.floor(diffMs / aDayMs_); // days
  const diffHrs = Math.floor((diffMs % aDayMs_) / anHourMs_); // hours
  const diffMins = Math.round(((diffMs % aDayMs_) % anHourMs_) / aMinuteMs_); // minutes
  const diffSecs = Math.round((((diffMs % aDayMs_) % anHourMs_) % aMinuteMs_) / aSecondMs_); // seconds
  // console.log("================")
  // console.log("diffMs ===> ", diffMs)
  // console.log("diffDays ===> ", diffDays)
  // console.log("diffHrs ===> ", diffHrs)
  // console.log("diffMins ===> ", diffMins)
  // console.log("================")

  if(      diffMs > 0 && diffDays > 0){
    return { diffMs, diffDhm: `${diffDays} วัน ${diffHrs} ชั่วโมง ${diffMins} นาที` }
  }else if(diffMs > 0 && diffDays == 0 && diffHrs > 0){
    return { diffMs, diffDhm: `${diffHrs} ชั่วโมง ${diffMins} นาที` }
  }else if(diffMs > 0 && diffDays == 0 && diffHrs == 0 && diffMins > 0){
    return { diffMs, diffDhm: `${diffMins} นาที` }
  }else if(diffMs > 0 && diffDays == 0 && diffHrs == 0 && diffMins == 0 && diffSecs > 0){
    return { diffMs, diffDhm: `${diffSecs} วินาที` }
  }else if(diffMs <= 0){
    return { diffMs, diffDhm: `-` }
  }
}

