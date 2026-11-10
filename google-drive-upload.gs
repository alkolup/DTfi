/**
 * Zkopírujte celý tento soubor do projektu na https://script.google.com
 * a nasaďte ho znovu: Deploy → Manage deployments → tužka → New version → Deploy.
 * Bez nového nasazení se na Disku dál zakládají nové soubory.
 * Složka na Disku je nastavená níže.
 */
var FOLDER_ID = '1uT1p5MxF1VSp8EvEGmoFOqgaTSH1IiPv';

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isStableFilename(name) {
  return /^DigiTool_[A-Za-z0-9._-]+\.json$/.test(name) && !/^DigiTool_\d{13}\.json$/.test(name);
}

function readIncomingBody(e) {
  if (e && e.parameter && e.parameter.payload) return String(e.parameter.payload);
  if (e && e.postData && e.postData.contents) {
    var raw = String(e.postData.contents);
    if (raw.indexOf('payload=') === 0) {
      return decodeURIComponent(raw.substring('payload='.length).replace(/\+/g, ' '));
    }
    return raw;
  }
  return '';
}

function fileIdKey(filename) {
  return 'fileid_' + filename;
}

function rememberFile(filename, file) {
  PropertiesService.getScriptProperties().setProperty(fileIdKey(filename), file.getId());
}

function fileByRememberedId(filename) {
  var id = PropertiesService.getScriptProperties().getProperty(fileIdKey(filename));
  if (!id) return null;
  try {
    var file = DriveApp.getFileById(id);
    if (file.isTrashed()) return null;
    return file;
  } catch (err) {
    return null;
  }
}

function trashSameNameExcept(folder, filename, keepId) {
  var removed = 0;
  var iterator = folder.getFilesByName(filename);
  while (iterator.hasNext()) {
    var candidate = iterator.next();
    if (candidate.getId() === keepId) continue;
    candidate.setTrashed(true);
    removed++;
  }
  return removed;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var raw = readIncomingBody(e);
    if (!raw) return jsonResponse({ ok: false, error: 'empty_body' });
    var data = JSON.parse(raw);
    var filename = data.filename ? String(data.filename) : '';
    var content = data.content || '';
    if (!isStableFilename(filename) || !content) {
      return jsonResponse({ ok: false, error: 'missing_or_unstable_filename' });
    }
    locked = lock.tryLock(20000);
    if (!locked) return jsonResponse({ ok: false, error: 'lock_timeout' });
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var kept = fileByRememberedId(filename);
    var updated = false;
    if (!kept) {
      var iterator = folder.getFilesByName(filename);
      while (iterator.hasNext()) {
        var candidate = iterator.next();
        if (!kept || candidate.getLastUpdated().getTime() >= kept.getLastUpdated().getTime()) {
          kept = candidate;
        }
      }
    }
    if (kept) {
      kept.setContent(content);
      updated = true;
    } else {
      var blob = Utilities.newBlob(content, 'application/json', filename);
      kept = folder.createFile(blob);
      kept.setName(filename);
    }
    rememberFile(filename, kept);
    var removed = trashSameNameExcept(folder, filename, kept.getId());
    return jsonResponse({
      ok: true,
      filename: filename,
      updated: updated,
      removed_duplicates: removed
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Jednorázově z editoru: zahodí soubory DigiTool_<čas>.json, které vznikly prázdným odesláním. */
function trashTimestampCopies() {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  var removed = 0;
  while (files.hasNext()) {
    var file = files.next();
    if (/^DigiTool_\d{13}\.json$/.test(file.getName())) {
      file.setTrashed(true);
      removed++;
    }
  }
  Logger.log('Zahodeno souborů: ' + removed);
}

function doGet() {
  return ContentService.createTextOutput('DigiTool – odesílání na Google Disk běží.');
}
