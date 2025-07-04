// Test the specific case mentioned by the user
const { normalizePhoneNumber, comparePhoneNumbers } = require('./src/utils/phoneUtils.js');

console.log('=== Testing Specific Case ===');
console.log('Group Creator adds member:');
console.log('Name: Santosh');
console.log('Phone: +91 8455 921 933');

const storedPhone = '+91 8455 921 933';
const enteredPhone = '8455921933';

console.log('\nStored phone (from group creation):', storedPhone);
console.log('Entered phone (when joining):', enteredPhone);

const normalizedStored = normalizePhoneNumber(storedPhone);
const normalizedEntered = normalizePhoneNumber(enteredPhone);

console.log('\nNormalized stored phone:', normalizedStored);
console.log('Normalized entered phone:', normalizedEntered);

const doTheyMatch = comparePhoneNumbers(storedPhone, enteredPhone);
console.log('\nDo they match?', doTheyMatch ? '✅ YES' : '❌ NO');

if (doTheyMatch) {
  console.log('\n✅ SUCCESS: Santosh can join the group with phone number 8455921933');
} else {
  console.log('\n❌ FAILED: Phone numbers do not match');
}

// Test other variations
console.log('\n=== Testing Other Variations ===');
const variations = [
  '8455921933',
  '8455 921 933',
  '+91 8455 921 933',
  '+918455921933',
  '918455921933',
  '8455-921-933',
  '(8455) 921-933'
];

variations.forEach(variation => {
  const matches = comparePhoneNumbers(storedPhone, variation);
  console.log(`${matches ? '✅' : '❌'} "${variation}" -> ${matches ? 'MATCHES' : 'NO MATCH'}`);
});

console.log('\n=== End Test ==='); 