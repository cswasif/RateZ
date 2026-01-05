// Convert the ASCII values from the test header to see the actual format
const headerBytes = [
    102, 114, 111, 109, 58, 114, 117, 110, 110, 105, 101, 114, 46, 108, 101, 97, 103, 117, 101,
    115, 46, 48, 106, 64, 105, 99, 108, 111, 117, 100, 46, 99, 111, 109, 13, 10
];

const fromHeader = String.fromCharCode(...headerBytes);
console.log('Test From header:', JSON.stringify(fromHeader));

// Parse it to understand the format
const colonIndex = fromHeader.indexOf(':');
const emailPart = fromHeader.substring(colonIndex + 1);
console.log('Email part:', JSON.stringify(emailPart));

// Check if there are angle brackets
const angleBracketIndex = emailPart.indexOf('<');
console.log('Angle bracket index:', angleBracketIndex);

if (angleBracketIndex !== -1) {
    const emailStart = angleBracketIndex + 1;
    const emailEnd = emailPart.indexOf('>', emailStart);
    const emailAddress = emailPart.substring(emailStart, emailEnd);
    console.log('Email address:', JSON.stringify(emailAddress));
    console.log('Email address length:', emailAddress.length);
    
    // Calculate the expected indices
    console.log('Expected From header index:', 0);
    console.log('Expected From header length:', fromHeader.length - 2); // -2 for \r\n
    console.log('Expected From address index:', colonIndex + 1 + emailStart);
    console.log('Expected From address length:', emailAddress.length);
} else {
    console.log('No angle brackets found - email is direct');
    const emailAddress = emailPart.trim();
    console.log('Email address:', JSON.stringify(emailAddress));
    console.log('Email address length:', emailAddress.length);
    
    console.log('Expected From header index:', 0);
    console.log('Expected From header length:', fromHeader.length - 2); // -2 for \r\n
    console.log('Expected From address index:', colonIndex + 1);
    console.log('Expected From address length:', emailAddress.length);
}