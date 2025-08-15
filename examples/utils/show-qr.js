/*
  Display a QR code for an XEC address in the terminal.
*/

const qrcode = require('qrcode-terminal')

// Get command line arguments
const args = process.argv.slice(2)

function showUsage () {
  console.log('Usage: node show-qr.js <xec_address> [size]')
  console.log('')
  console.log('Size options:')
  console.log('  tiny   - Ultra compact QR code (6 lines)')
  console.log('  small  - Compact QR code (8 lines)')
  console.log('  medium - Standard QR code (16 lines, default)')
  console.log('')
  console.log('Examples:')
  console.log('  node show-qr.js ecash:qz33uqa8jdx2dlnjflnrqrj3nrrnuvlzsgtvkhxz0n')
  console.log('  node show-qr.js ecash:qz33uqa8jdx2dlnjflnrqrj3nrrnuvlzsgtvkhxz0n tiny')
  console.log('  node show-qr.js ecash:qz33uqa8jdx2dlnjflnrqrj3nrrnuvlzsgtvkhxz0n small')
  console.log('  node show-qr.js ecash:qz33uqa8jdx2dlnjflnrqrj3nrrnuvlzsgtvkhxz0n medium')
}

function generateCustomQR (text, size) {
  if (size === 'tiny') {
    // Generate actual QR code with lowest error correction and minimal output
    qrcode.generate(text, {
      small: true,
      errorLevel: 'L' // Lowest error correction = smaller QR code
    }, (qrString) => {
      // Take every 3rd line and every 2nd character to make it much smaller
      const lines = qrString.split('\n').filter(line => line.trim())
      const tinyLines = []

      for (let i = 0; i < lines.length; i += 3) {
        if (lines[i]) {
          // Take every 2nd character to compress horizontally
          const compressedLine = lines[i].split('').filter((_, idx) => idx % 2 === 0).join('')
          tinyLines.push(compressedLine)
        }
      }

      console.log(tinyLines.join('\n'))
    })
    return
  }

  if (size === 'small') {
    // Generate QR code with low error correction and moderate compression
    qrcode.generate(text, {
      small: true,
      errorLevel: 'L' // Lowest error correction
    }, (qrString) => {
      // Take every 2nd line to make it smaller vertically
      const lines = qrString.split('\n').filter(line => line.trim())
      const smallLines = lines.filter((_, index) => index % 2 === 0)

      console.log(smallLines.join('\n'))
    })
    return
  }

  // Default medium size (original small with medium error correction)
  qrcode.generate(text, {
    small: true,
    errorLevel: 'M' // Medium error correction for better reliability
  })
}

// function getQROptions (size) {
//   // This function is kept for compatibility but we use generateCustomQR now
//   return { small: true }
// }

function showQRCode () {
  try {
    // Check arguments
    if (args.length < 1 || args.length > 2) {
      showUsage()
      process.exit(1)
    }

    if (args.includes('--help') || args.includes('-h')) {
      showUsage()
      process.exit(0)
    }

    const address = args[0]
    const size = args[1] || 'medium'

    // Basic validation
    if (!address || !address.startsWith('ecash:')) {
      console.log('Error: Invalid XEC address format')
      process.exit(1)
    }

    // Validate size option
    if (!['tiny', 'small', 'medium'].includes(size)) {
      console.log('Error: Invalid size option. Use: tiny, small, or medium')
      showUsage()
      process.exit(1)
    }

    // Display address info
    console.log(`Address: ${address}`)
    console.log(`Length: ${address.length} characters`)
    console.log('Network: eCash (XEC) Mainnet')

    // Generate and display QR code with specified size
    generateCustomQR(address, size)
  } catch (err) {
    console.error('Failed to generate QR code:', err.message)
    process.exit(1)
  }
}

// Run the utility
showQRCode()
