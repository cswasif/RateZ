# 🚀 BRACU Anonymous Review System

A privacy-first anonymous review system for BRACU students using Zero-Knowledge proofs. Students can submit reviews anonymously while proving they have a valid `@g.bracu.ac.bd` email address.

## 🔒 Privacy-First Authentication

**No OAuth, No Tracking, Complete Anonymity**

Unlike traditional systems that use Gmail OAuth (which exposes your identity to Google), this system processes your email content **locally in your browser**. Google never knows you're submitting a review.

### 🎯 Authentication Methods

1. **📋 Manual Paste**: Copy email content and paste directly
2. **📧 Upload .eml File**: Download and upload email files

Both methods process your email **locally** - no external API calls, no data sharing.

## 🛠️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │    Circuits       │
│                 │    │                  │    │                   │
│ 📧 Drag & Drop  │───▶│ 🔐 Verify Proof  │◀───│ 🧮 ZK Proofs      │
│ 🎯 Local Proving│    │ 🎭 Nullifier CK  │    │ 🔏 RSA Signatures │
│ 🔄 Fallback     │◀───│ 📊 Session Mgmt  │    │ 🏷️ Domain Check   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <your-repo>
cd bracu-anonymous-review

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the application.

## 🔐 How It Works

### For Students
1. **Get Your Email**: Open any email from your `@g.bracu.ac.bd` account
2. **Extract Content**: 
   - **Manual**: Copy the complete email content (Headers → "Show Original" → Copy)
   - **File Upload**: Download as `.eml` file (Three Dots → "Download Message")
3. **Submit Anonymously**: Paste content or upload file - proof generates locally
4. **Review Freely**: Submit reviews with complete anonymity

### Technical Flow
1. **Local Processing**: Email content never leaves your browser
2. **ZK Proof Generation**: Circuit validates DKIM signature and domain
3. **Anonymous Verification**: Proof confirms you're a BRACU student without revealing identity
4. **Session Creation**: Anonymous session with nullifier to prevent duplicates

## 🎯 Key Features

- **🔒 True Anonymity**: No OAuth, no Google tracking, local processing only
- **🧮 Zero-Knowledge Proofs**: Cryptographic proof without revealing email content
- **🎭 Anti-Sybil**: Nullifier system prevents duplicate reviews per email
- **📱 Mobile Friendly**: Works on all devices with responsive design
- **⚡ Fast Performance**: Local proof generation, no external dependencies

## 📁 Project Structure

```
packages/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/     # AuthPage with privacy-first UI
│   │   ├── lib/       # Email parsing, ZK prover
│   │   └── auth/      # ZK authentication provider
│   └── public/        # Circuit WASM files
├── api/               # Backend API (Cloudflare Workers)
│   ├── src/
│   │   ├── lib/       # ZK verification, nullifier management
│   │   └── routes/    # Authentication endpoints
│   └── wrangler.toml  # Cloudflare deployment config
└── circuits/          # Circom ZK circuits
    ├── bracu_verifier.circom  # Main verification circuit
    └── scripts/       # Compilation scripts
```

## 🔧 Development

### Frontend Development
```bash
cd packages/frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

### API Development
```bash
cd packages/api
npm run dev          # Start local dev server
npm run deploy       # Deploy to Cloudflare
```

### Circuit Development (Optional)
```bash
cd packages/circuits
npm run compile      # Compile circuits (requires circom)
```

## 🚀 Deployment

### Frontend (Vite + Static Hosting)
```bash
cd packages/frontend
npm run build
# Deploy dist/ folder to your hosting provider
```

### Backend (Cloudflare Workers)
```bash
cd packages/api
npm run deploy
```

## 🔍 Testing

### Development Mode
The system includes mock verification for easy development:
- ✅ Accepts any valid BRACU email format
- ✅ Generates mock proofs instantly
- ✅ Perfect for UI/UX testing

### Production Mode
After circuit compilation:
- 🔐 Real ZK proof generation
- ✅ Cryptographic verification
- ⚡ Optimized for performance

## 📋 Authentication Instructions

### Method 1: Manual Paste
1. Open Gmail → Any email → Three dots (⋮) → "Show Original"
2. Click "Copy to Clipboard" or select all and copy
3. Paste into the authentication form
4. Click "Verify & Login Anonymously"

### Method 2: Upload .eml File
1. Open Gmail → Any email → Three dots (⋮) → "Download Message"
2. Save the `.eml` file to your computer
3. Drag & drop file into the upload area or click to browse
4. Click "Verify & Login Anonymously"

## 🛡️ Security & Privacy

### Privacy Guarantees
- **Local Processing**: All email processing happens in your browser
- **No External Calls**: Zero API calls to Google or third parties
- **Anonymous Sessions**: No identifying information stored
- **Cryptographic Proofs**: ZK proofs ensure validity without exposure

### Security Features
- **DKIM Verification**: Validates email authenticity
- **Domain Restriction**: Only `@g.bracu.ac.bd` emails accepted
- **Nullifier System**: Prevents duplicate accounts
- **Session Management**: Secure anonymous sessions

## 📊 Performance

- **Proof Generation**: 5-30 seconds (depending on email size)
- **Verification**: < 1 second
- **Session Creation**: < 500ms
- **Mobile Compatible**: Works on all modern browsers

## 🎯 Future Enhancements

- [ ] Multi-domain support (other universities)
- [ ] Batch proof generation
- [ ] Advanced nullifier schemes
- [ ] Mobile app integration
- [ ] Enhanced privacy features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source. See LICENSE file for details.

## 🔗 Links

- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)
- [Circom Documentation](https://docs.circom.io/)
- [BRACU Website](https://www.bracu.ac.bd/)

---

**Built with ❤️ for BRACU students who value privacy and anonymity.**