/**
 * AI3D Cloud — LINE ⇄ Bobo bridge (Google Apps Script web app) · v5.9.1
 * LINE webhook → this script → replies instantly (สถานะ / ผล / ช่วย) or saves the command to
 * Drive "AI3D_Cloud/05_คำสั่ง_LINE" for the hourly Bobo cloud task, which replies with the result.
 * Images / PDF / files sent in LINE are saved as a new job in "01_งานใหม่".
 * Secrets are NOT stored here: the token and owner userId are read from "AI3D_Cloud/LINE_ตั้งค่า.txt".
 * Deploy: Web app · Execute as: Me · Who has access: Anyone → put the /exec URL in LINE Developers › Webhook URL.
 */
const ROOT = '1m_2K5et1rQOBbaJ_sbqUKcqKYVhBjZW5';      // AI3D_Cloud
const NEW = '1URak5qApmPHHiG7FkxCewIimcOh_LB0u';       // 01_งานใหม่
const DOING = '15nEdLwfSFWmMYDbHLgtUGN-AFjXSBZPG';     // 02_กำลังทำ
const DONE = '1ll0JeTDC3O3K5yoPR1bYSsfbaMEQOwWS';      // 03_เสร็จแล้ว
const CMD = '1wu_SbtxwUwVTF46zW5CvreRzHWgSHzsz';       // 05_คำสั่ง_LINE
const CONF = '15NwMuPABBMySwHB1NbPc_EbVrgD1I_I2';      // LINE_ตั้งค่า.txt

function conf_() {
  const c = CacheService.getScriptCache(); const k = c.get('conf'); if (k) return JSON.parse(k);
  const t = DriveApp.getFileById(CONF).getBlob().getDataAsString('UTF-8'); const o = {};
  t.split(/\r?\n/).forEach(l => { const i = l.indexOf('='); if (i > 0) o[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  c.put('conf', JSON.stringify(o), 600); return o;
}
function api_(path, body, data) {
  const C = conf_();
  return UrlFetchApp.fetch((data ? 'https://api-data.line.me' : 'https://api.line.me') + path, Object.assign({
    headers: { Authorization: 'Bearer ' + C.CHANNEL_TOKEN }, muteHttpExceptions: true
  }, body ? { method: 'post', contentType: 'application/json', payload: JSON.stringify(body) } : {}));
}
function reply_(token, text) { api_('/v2/bot/message/reply', { replyToken: token, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }); }
function count_(id) { let n = 0; const it = DriveApp.getFolderById(id).getFolders(); while (it.hasNext()) { it.next(); n++; } return n; }
function names_(id, max) { const a = []; const it = DriveApp.getFolderById(id).getFolders(); while (it.hasNext() && a.length < max) a.push(it.next().getName()); return a; }
function stamp_() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss'); }
function lineJob_() { // today's LINE job folder in 01_งานใหม่ (files sent in LINE go here until the user types "พร้อม")
  const name = 'LINE_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd');
  const it = DriveApp.getFolderById(NEW).getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.getFolderById(NEW).createFolder(name);
}
const HELP = 'คำสั่ง Bobo AI3D\n• สถานะ — งานรอ/กำลังทำ/เสร็จ\n• ผล <ชื่อโครงการ> — ลิงก์ผล\n• ส่งรูป/PDF/DXF ในแชตนี้ แล้วพิมพ์ "พร้อม" — สร้างงานใหม่\n• รันเลย — ให้ Bobo เริ่มรอบถัดไปทันทีที่ทำได้\n• แก้ <ชื่อโครงการ>: <สิ่งที่ต้องแก้> — แก้โมเดลแล้วรันใหม่\n• ถามอะไรก็ได้ — Bobo ตอบในรอบถัดไป';

function doGet() { return ContentService.createTextOutput('AI3D LINE bridge OK'); }
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}'); const C = conf_();
    (body.events || []).forEach(ev => {
      if (!ev.replyToken || !ev.source) return;
      if (ev.source.userId !== C.TO) { reply_(ev.replyToken, 'บัญชีนี้รับคำสั่งจากเจ้าของเท่านั้น'); return; }
      if (ev.type === 'follow') { reply_(ev.replyToken, 'สวัสดีครับ Bobo AI3D พร้อมทำงาน\n\n' + HELP); return; }
      if (ev.type !== 'message') return;
      const m = ev.message;
      if (['image', 'file', 'video'].includes(m.type)) {
        const r = api_('/v2/bot/message/' + m.id + '/content', null, true);
        if (r.getResponseCode() !== 200) { reply_(ev.replyToken, 'ดาวน์โหลดไฟล์จาก LINE ไม่สำเร็จ (' + r.getResponseCode() + ')'); return; }
        const ext = m.type === 'image' ? '.jpg' : '';
        const blob = r.getBlob().setName(m.fileName || ('LINE_' + stamp_() + ext));
        const f = lineJob_(); f.createFile(blob);
        reply_(ev.replyToken, '📥 รับไฟล์แล้ว: ' + blob.getName() + '\nเก็บใน 01_งานใหม่/' + f.getName() + '\nส่งไฟล์เพิ่มได้ เสร็จแล้วพิมพ์ "พร้อม"');
        return;
      }
      if (m.type !== 'text') return;
      const t = String(m.text || '').trim();
      if (/^(ช่วย|help|\?|เมนู)$/i.test(t)) { reply_(ev.replyToken, HELP); return; }
      if (/^สถานะ/.test(t)) {
        const a = count_(NEW), b = count_(DOING), c = count_(DONE), q = DriveApp.getFolderById(CMD).getFiles();
        let nq = 0; while (q.hasNext()) { q.next(); nq++; }
        reply_(ev.replyToken, '📊 สถานะ Bobo AI3D\n• งานรอ: ' + a + (a ? ' (' + names_(NEW, 5).join(', ') + ')' : '') + '\n• กำลังทำ: ' + b + (b ? ' (' + names_(DOING, 3).join(', ') + ')' : '') + '\n• เสร็จแล้ว: ' + c + '\n• คำสั่งรอทำ: ' + nq + '\nรอบถัดไป: นาที :06 ของทุกชั่วโมง');
        return;
      }
      let mm = t.match(/^ผล\s*(.+)$/);
      if (mm) {
        const it = DriveApp.getFolderById(DONE).searchFolders('title contains "' + mm[1].replace(/"/g, '') + '"');
        reply_(ev.replyToken, it.hasNext() ? (f => '📁 ' + f.getName() + '\n' + f.getUrl())(it.next()) : 'ไม่พบโครงการ "' + mm[1] + '" ใน 03_เสร็จแล้ว');
        return;
      }
      if (/^(พร้อม|ส่งงาน)$/.test(t)) {
        const f = lineJob_(); if (!f.getFiles().hasNext()) { reply_(ev.replyToken, 'ยังไม่มีไฟล์แบบวันนี้ — ส่งรูป/PDF/DXF ในแชตก่อน'); return; }
        f.setName(f.getName() + '_' + stamp_().slice(9)); f.createFile('พร้อม.txt', 'ready ' + new Date().toISOString());
        reply_(ev.replyToken, '✅ ส่งงาน ' + f.getName() + ' แล้ว — Bobo เริ่มในรอบถัดไป (นาที :06) และจะแจ้งผลในแชตนี้'); return;
      }
      DriveApp.getFolderById(CMD).createFile('cmd_' + stamp_() + '.json', JSON.stringify({ text: t, at: new Date().toISOString(), from: 'line' }), 'application/json');
      reply_(ev.replyToken, '📝 รับคำสั่งแล้ว: ' + t.slice(0, 200) + '\nBobo จะทำในรอบถัดไป (นาที :06) แล้วตอบผลในแชตนี้');
    });
  } catch (err) { console.error(err); }
  return ContentService.createTextOutput('OK');
}
