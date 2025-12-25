const checkWord = require('check-word');
const words = checkWord('en');

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const randId = (len = 16) =>
  Math.random().toString(36).slice(2, 2 + len) +
  Math.random().toString(36).slice(2, 2 + len);

const randomLetter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));

const generateRoomCode = (existingRooms) => {
  let code = '';
  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (existingRooms[code]);
  return code;
};

const validateMove = (word, p1Letter, p2Letter, minLength) => {
  const cleanWord = String(word || '').trim().toLowerCase();

  if (cleanWord.length < minLength) {
    return { isValid: false, reason: `Min ${minLength} chars` };
  }

  if (!words.check(cleanWord)) {
    return { isValid: false, reason: 'Not a word' };
  }

  const a = String(p1Letter || '').toLowerCase();
  const b = String(p2Letter || '').toLowerCase();

  const matches =
    (cleanWord.startsWith(a) && cleanWord.endsWith(b)) ||
    (cleanWord.startsWith(b) && cleanWord.endsWith(a));

  if (!matches) {
    return { isValid: false, reason: 'Wrong letters' };
  }

  return { isValid: true, cleanWord };
};

module.exports = {
  normalizeCode,
  randId,
  randomLetter,
  generateRoomCode,
  validateMove
};