// 
// import multer from 'multer';
// import fs from 'fs';
// import path from 'path';
// const qs = require('qs');          // V3.95
// const axios = require('axios');    // V3.95

import qs from 'qs';
import axios from 'axios';
// import * as myDateTime from "./myDateTime.js"

// //================================================
// //
// export async function isValidBot(botToken,groupChatId) {
//   let isValid = false
//   if(botToken.length > 40 && !isNaN(Number(groupChatId)) ){
//     if(Number(groupChatId) < 0){
//       isValid = true
//     }
//   }
//   return isValid
// }



//===============================
// ส่งข้อความเข้ากลุ่ม Telegram
// 
export async function sendMsgToGroup(message, botToken, groupChatId) {
  try {
    const data = qs.stringify({
      chat_id: groupChatId,
      text: message
    })

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, 
      data, 
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } } 
    )
    // console.log('Message sent to group successfully:', response.data)
    return response.data
  } catch (error) {
    console.error('Error sending message to group:', error.message)
    return null
  }
}

