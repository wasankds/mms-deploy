
import { MongoClient } from 'mongodb';
// import path from 'path';
// import fs from 'fs';
// import odbc from 'odbc';
// import { ObjectId } from 'mongodb';  

// //================================= 
// // Query สำหรับฐานข้อมูล Access
// // 
// export async function submitQuery(dbFilePath, queryString) {
//   // const msDriver = '{Microsoft Access Driver (*.mdb, *.accdb)}'
//   const connectionString = `Driver=${MS_DRIVER};DBQ=${dbFilePath};`;
//   let connection = await odbc.connect(connectionString);
//   try {
//     const result = await connection.query(queryString)
//     return result
//   } catch (error) {
//     console.error('เกิดข้อผิดพลาดในการอ่านฐานข้อมูล:', error);
//     return [];
//   } finally {
//     if (connection) {
//       await connection.close();
//     }
//   }
// }


//===========================================
// ใช้สำหรับ Render View โดยลบ comment HTML ออก
// 
export async function renderView(viewName, res, obj){
  return new Promise((resolve, reject) => {
    res.render(viewName, obj, (err, html) => {
      if (err) {
        console.error('Error rendering EJS:', err)
        reject(err)
      } else {
        const cleanedHtml = cleanHtml(html)
        resolve(cleanedHtml)
      }
    })
  })
}
//================================================
export const cleanHtml = (htmlString) => {
  return htmlString.replace(/<!--[\s\S]*?-->/g, '')
                   .replace(/^\s*[\r\n]/gm, '')
}

//================================================
// จับการตั้งค่าจากแท็บ General
// 
export async function getSettings() {
  const client = new MongoClient(global.dbUrl)
  const db = client.db(global.dbName)
  await client.connect()
  const coll_settings = db.collection(global.dbColl_settings)
  const settings = await coll_settings.findOne({})
  client.close()

  return settings
}

//================================================
// จับการตั้งค่าจากแท็บ อิเมล์
// - บันทึกแยกในฐานข้อมูลคนละ collection กับการตั้งค่าทั่วไป
// 
// export async function getSettingsSystem_Email() {
export async function getSettingsSystem() {
  const client = new MongoClient(global.dbUrl)
  const db = client.db(global.dbName)
  await client.connect()
  const collection = db.collection(global.dbColl_settingsSystem)
  const settingsEmail = await collection.findOne({})
  client.close()
  return settingsEmail
}

// //================================================
// // จับการตั้งค่าตามชื่อคอลเล็กชั่นที่ส่งมา
// // 
// export async function getSettingsByCollection(collectionName) {
//   const client = new MongoClient(global.dbUrl)
//   const db = client.db(global.dbName)
//   await client.connect()
//   const coll_settings = db.collection(collectionName)
//   const dataSettings = await coll_settings.findOne({})
//   client.close()
//   return {
//     dataSettings : dataSettings
//   }
// }

//================================================
//
export async function generateResetCode() {
  const charsCap = "ABCDEFGHIJKLMNPQRSTUVWXYZ"
  const charsLow = "abcdefghijklmnpqrstuvwxyz"
  const numbers = "123456789"
  const specials = "!@#$%^&*?"
  let resetCode = ''
  for (let i=0;i<2;i++) {
    resetCode += charsLow.charAt(Math.floor(Math.random() * charsLow.length))
    resetCode += charsCap.charAt(Math.floor(Math.random() * charsCap.length))
    resetCode += numbers.charAt(Math.floor(Math.random() * numbers.length))
  }
  for (let i=0;i<2;i++) {
    resetCode += specials.charAt(Math.floor(Math.random() * specials.length))
  }
  return resetCode.split('').sort(() => 0.5 - Math.random()).join('')  
}



//================================================
//
// 
export async function generatePassword() {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  const numbers = "123456789"
  let password = ''
  for (let i=0;i<3;i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
    password += numbers.charAt(Math.floor(Math.random() * numbers.length))
  }
  return password.split('').sort(() => 0.5 - Math.random()).join('')
}


//================================================
// จัดรูปแบบตัวเลขเพียวๆ เช่น 1234.56 ให้เป็นแบบ 1,234.56
// - ถ้าเป็นค่าว่าง ให้แสดงเป็น 0.00
// - Comma-Separated Decimal Notation 
export function formatNumber_as_Thai(num) {
  return (num !== undefined && num !== null && !isNaN(num))
    ? Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
}



// //================================================
// // จับโลโก้เป็น Base64 ตามชื่อไฟล์ ซึ่งผูกกับชื่อของเอกสาร
// // 
// export function getLogoBase64Src(filename) {
//   let logoSrc_base64 = null
//   const logoFilePath = path.join(global.folderDocs, filename);
//   if (fs.existsSync(logoFilePath)) {
//     const imageBuffer = fs.readFileSync(logoFilePath)
//     const base64Image = imageBuffer.toString('base64')
//     logoSrc_base64 = `data:image/png;base64,${base64Image}`
//   }
//   return logoSrc_base64
// }



// //================================================
// export async function getSettings() {
//   const client = new MongoClient(global.dbUrl)
//   const db = client.db(global.dbName)
//   await client.connect()
//   const coll_settings = db.collection(dbColl_settings)
//   const dataSettings = await coll_settings.findOne({})
//   client.close()
//   return {
//     dataSettings : dataSettings
//   }
// }
// //================================================
// export async function getSettings_quotation() {
//   const client = new MongoClient(global.dbUrl)
//   const db = client.db(global.dbName)
//   await client.connect()
//   const coll_settings = db.collection(global.dbColl_settings_Quotation)
//   const dataSettings = await coll_settings.findOne({})
//   client.close()
//   return {
//     dataSettings : dataSettings
//   }
// }
// //================================================
// export  async function getSettings_invoice() {
//   const client = new MongoClient(global.dbUrl)
//   const db = client.db(global.dbName)
//   await client.connect()
//   const coll_settings = db.collection(global.dbColl_settings_Invoice)
//   const dataSettings = await coll_settings.findOne({})
//   client.close()
//   return {
//     dataSettings : dataSettings
//   }
// }
// //================================================
// export  async function getSettings_receipt()   {
//   const client = new MongoClient(global.dbUrl)
//   const db = client.db(global.dbName)
//   await client.connect()
//   const coll_settings = db.collection(global.dbColl_settings_Receipt)
//   const dataSettings = await coll_settings.findOne({})
//   client.close()
//   return {
//     dataSettings : dataSettings
//   }
// }
// //================================================
// export  async function getSettings_bill()   {
//   const client = new MongoClient(global.dbUrl)
//   const db = client.db(global.dbName)
//   await client.connect()
//   const coll_settings = db.collection(global.dbColl_settings_Bill)
//   const dataSettings = await coll_settings.findOne({})
//   client.close()
//   return {
//     dataSettings : dataSettings
//   }
// }
