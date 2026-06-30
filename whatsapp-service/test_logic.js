// Verification test script for Node.js logic

const assert = require('assert');

// 1. Spintax Engine Test (Refined to only match blocks with at least one | character)
function parseSpintax(text) {
  if (!text) return '';
  const spintaxPattern = /\{([^{}]*\|[^{}]*)\}/g;
  let matches;
  while ((matches = spintaxPattern.exec(text)) !== null) {
    const options = matches[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    text = text.replace(matches[0], randomOption);
    spintaxPattern.lastIndex = 0; // Reset index to re-scan from start
  }
  return text;
}

console.log('Testing Spintax Engine...');
const template = '{Merhaba|Selam} {İsim}, bugüne özel indirim kodunuz: {Kod}!';
const parsed1 = parseSpintax(template);
console.log('Template:', template);
console.log('Parsed Example 1:', parsed1);

// Assertions to verify options are selected correctly
assert(parsed1.includes('Merhaba') || parsed1.includes('Selam'), 'Failed to parse first brace');
assert(parsed1.includes('{İsim}'), 'Variables should remain intact for the next stage');
assert(parsed1.includes('{Kod}'), 'Variables should remain intact for the next stage');

// Nested / Multiple braces test
const nestedTemplate = '{A|B} and {C|D}';
const parsedNested = parseSpintax(nestedTemplate);
console.log('Template 2:', nestedTemplate);
console.log('Parsed Nested:', parsedNested);
assert((parsedNested.startsWith('A') || parsedNested.startsWith('B')) && (parsedNested.endsWith('C') || parsedNested.endsWith('D')), 'Failed nested/multiple brace spintax');

// 2. Formatting Test
function formatToJid(number) {
  if (typeof number !== 'string') return '';
  number = number.trim();
  if (number.endsWith('@s.whatsapp.net') || number.endsWith('@g.us')) {
    return number;
  }
  let cleaned = number.replace(/\D/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

console.log('\nTesting Phone to JID formatting...');
assert.strictEqual(formatToJid('+90 555 123 4567'), '905551234567@s.whatsapp.net');
assert.strictEqual(formatToJid('447700900077@s.whatsapp.net'), '447700900077@s.whatsapp.net');
assert.strictEqual(formatToJid('12059301293-19302@g.us'), '12059301293-19302@g.us'); // Group ID remains group ID (without @s.whatsapp.net)
console.log('JID format tests passed successfully!');

console.log('\nAll core Node.js helper logic tests PASSED!');
