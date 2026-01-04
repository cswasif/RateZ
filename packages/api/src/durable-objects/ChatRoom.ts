import { DurableObject } from 'cloudflare:workers'

export interface ChatMessage {
  type: 'message' | 'join' | 'leave' | 'system'
  userId: string
  username: string
  content: string
  timestamp: number
  messageId: string
}

export interface UserSession {
  userId: string
  username: string
  websocket: WebSocket
  joinedAt: number
  lastActivity: number
  metadata?: Record<string, any>
}

export interface RoomState {
  roomId: string
  createdAt: number
  participants: Map<string, UserSession>
  messageHistory: ChatMessage[]
  maxHistory: number
  isPrivate: boolean
  allowedUsers?: Set<string>
  roomMetadata?: Record<string, any>
}

export class ChatRoom extends DurableObject {
  private state: RoomState
  private sessions: Map<string, UserSession>
  private messageHistory: ChatMessage[]
  private maxHistory: number = 100
  private roomMetadata: Record<string, any>

  constructor(state: DurableObjectState, env: any) {
    super(state, env)

    // Initialize room state
    this.sessions = new Map()
    this.messageHistory = []
    this.roomMetadata = {}

    this.state = {
      roomId: '',
      createdAt: Date.now(),
      participants: this.sessions,
      messageHistory: this.messageHistory,
      maxHistory: this.maxHistory,
      isPrivate: false,
      allowedUsers: undefined,
      roomMetadata: this.roomMetadata
    }

    // Note: loadState() is called in fetch() before WebSocket handling
    // Constructor cannot be async, so we defer loading
  }

  /**
   * Generate anonymous display name (no real identity)
   */
  private generateAnonName(): string {
    const adjectives = ['Swift', 'Bright', 'Calm', 'Bold', 'Wise', 'Kind', 'Quick', 'Sharp']
    const animals = ['Fox', 'Owl', 'Bear', 'Wolf', 'Lion', 'Hawk', 'Deer', 'Tiger']
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const animal = animals[Math.floor(Math.random() * animals.length)]
    const num = Math.floor(Math.random() * 100)
    return `${adj}${animal}${num}`
  }

  /**
   * Hash session token to anonymous ID (unlinkable to real identity)
   */
  private async hashToAnonId(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(`anon:${token}`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return 'anon_' + hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Load persisted state from storage
   */
  private async loadState(): Promise<void> {
    try {
      const stored = await this.ctx.storage.get<{
        roomId: string
        createdAt: number
        messageHistory: ChatMessage[]
        maxHistory: number
        isPrivate: boolean
        allowedUsers?: string[]
        roomMetadata?: Record<string, any>
      }>('room_state')

      if (stored) {
        this.state.roomId = stored.roomId
        this.state.createdAt = stored.createdAt
        this.messageHistory = stored.messageHistory || []
        this.maxHistory = stored.maxHistory || 100
        this.state.isPrivate = stored.isPrivate || false
        this.state.allowedUsers = stored.allowedUsers ? new Set(stored.allowedUsers) : undefined
        this.roomMetadata = stored.roomMetadata || {}

        // Trim history to max length
        if (this.messageHistory.length > this.maxHistory) {
          this.messageHistory = this.messageHistory.slice(-this.maxHistory)
        }
      }
    } catch (error) {
      console.error('Error loading room state:', error)
    }
  }

  /**
   * Persist current state to storage
   */
  private async saveState(): Promise<void> {
    try {
      const stateToSave = {
        roomId: this.state.roomId,
        createdAt: this.state.createdAt,
        messageHistory: this.messageHistory,
        maxHistory: this.maxHistory,
        isPrivate: this.state.isPrivate,
        allowedUsers: this.state.allowedUsers ? Array.from(this.state.allowedUsers) : undefined,
        roomMetadata: this.roomMetadata
      }

      await this.ctx.storage.put('room_state', stateToSave)
    } catch (error) {
      console.error('Error saving room state:', error)
    }
  }

  /**
   * Handle WebSocket connection
   */
  async fetch(request: Request): Promise<Response> {
    try {
      // Load state before handling connection
      await this.loadState()

      const upgradeHeader = request.headers.get('Upgrade')
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 })
      }

      const url = new URL(request.url)
      // ANONYMITY: Only use session token, not userId!
      const sessionToken = url.searchParams.get('token')
      const roomId = url.searchParams.get('roomId') || 'default'

      if (!sessionToken) {
        return new Response('Missing token parameter', { status: 400 })
      }

      // TODO: Validate sessionToken against SESSIONS KV in production
      // For now, generate anonymous ID from token hash
      const anonId = await this.hashToAnonId(sessionToken)

      // Set room ID if not already set
      if (!this.state.roomId) {
        this.state.roomId = roomId
      }

      // Check room access if private (uses anonId, not real identity)
      if (this.state.isPrivate && this.state.allowedUsers) {
        if (!this.state.allowedUsers.has(anonId)) {
          return new Response('Access denied to private room', { status: 403 })
        }
      }

      // Create WebSocket pair
      const webSocketPair = new WebSocketPair()
      const [client, server] = Object.values(webSocketPair)

      // Accept the WebSocket connection
      server.accept()

      // Generate anonymous display name (no real names!)
      const anonName = this.generateAnonName()

      // Create user session with ANONYMOUS identity only
      const session: UserSession = {
        userId: anonId,  // Anonymous ID, not real identity
        username: anonName,  // Random name, not real name
        websocket: server,
        joinedAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {} // No authToken stored
      }

      // Add session to room
      this.sessions.set(anonId, session)

      // Send welcome message
      this.sendToUser(session, {
        type: 'system',
        userId: 'system',
        username: 'System',
        content: `Welcome to room ${this.state.roomId}!`,
        timestamp: Date.now(),
        messageId: crypto.randomUUID()
      })

      // Send recent message history
      this.sendMessageHistory(session)

      // Broadcast join message to other users
      this.broadcast({
        type: 'join',
        userId: anonId,
        username: anonName,
        content: `${anonName} joined the room`,
        timestamp: Date.now(),
        messageId: crypto.randomUUID()
      }, anonId) // Exclude the joining user

      // Set up message handler
      server.addEventListener('message', async (event) => {
        await this.handleMessage(session, event.data)
      })

      // Set up close handler
      server.addEventListener('close', async () => {
        await this.handleDisconnect(session)
      })

      // Set up error handler
      server.addEventListener('error', (error) => {
        console.error(`WebSocket error for user ${anonId}:`, error)
        this.handleDisconnect(session)
      })

      // Save state after connection
      await this.saveState()

      return new Response(null, {
        status: 101,
        webSocket: client,
      })
    } catch (error) {
      console.error('Error handling WebSocket connection:', error)
      return new Response('Internal server error', { status: 500 })
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(session: UserSession, data: string | ArrayBuffer): Promise<void> {
    try {
      // Update last activity
      session.lastActivity = Date.now()

      let message: Partial<ChatMessage>

      try {
        message = JSON.parse(data.toString())
      } catch (error) {
        this.sendToUser(session, {
          type: 'system',
          userId: 'system',
          username: 'System',
          content: 'Invalid message format',
          timestamp: Date.now(),
          messageId: crypto.randomUUID()
        })
        return
      }

      // Validate message
      if (!message.content || typeof message.content !== 'string') {
        this.sendToUser(session, {
          type: 'system',
          userId: 'system',
          username: 'System',
          content: 'Message content is required',
          timestamp: Date.now(),
          messageId: crypto.randomUUID()
        })
        return
      }

      // Limit message length
      if (message.content.length > 2000) {
        this.sendToUser(session, {
          type: 'system',
          userId: 'system',
          username: 'System',
          content: 'Message too long (max 2000 characters)',
          timestamp: Date.now(),
          messageId: crypto.randomUUID()
        })
        return
      }

      // Sanitize content (basic XSS protection)
      const sanitizedContent = this.sanitizeContent(message.content)

      // Create chat message
      const chatMessage: ChatMessage = {
        type: 'message',
        userId: session.userId,
        username: session.username,
        content: sanitizedContent,
        timestamp: Date.now(),
        messageId: crypto.randomUUID()
      }

      // Add to history
      this.messageHistory.push(chatMessage)

      // Trim history if too long
      if (this.messageHistory.length > this.maxHistory) {
        this.messageHistory = this.messageHistory.slice(-this.maxHistory)
      }

      // Broadcast to all users (including sender for confirmation)
      this.broadcast(chatMessage)

      // Save state after message
      await this.saveState()
    } catch (error) {
      console.error('Error handling message:', error)
      this.sendToUser(session, {
        type: 'system',
        userId: 'system',
        username: 'System',
        content: 'Error processing message',
        timestamp: Date.now(),
        messageId: crypto.randomUUID()
      })
    }
  }

  /**
   * Handle user disconnection
   */
  private async handleDisconnect(session: UserSession): Promise<void> {
    try {
      // Remove from sessions
      this.sessions.delete(session.userId)

      // Close WebSocket if not already closed (1 = OPEN in Workers)
      if (session.websocket.readyState === 1) {
        session.websocket.close()
      }

      // Broadcast leave message to remaining users
      if (this.sessions.size > 0) {
        this.broadcast({
          type: 'leave',
          userId: session.userId,
          username: session.username,
          content: `${session.username} left the room`,
          timestamp: Date.now(),
          messageId: crypto.randomUUID()
        })
      }

      // Save state after disconnection
      await this.saveState()
    } catch (error) {
      console.error('Error handling disconnect:', error)
    }
  }

  /**
   * Broadcast message to all users in room
   */
  private broadcast(message: ChatMessage, excludeUserId?: string): void {
    const messageStr = JSON.stringify(message)

    for (const [odId, session] of this.sessions) {
      // WebSocket.OPEN = 1 in Workers runtime
      if (odId !== excludeUserId && session.websocket.readyState === 1) {
        try {
          session.websocket.send(messageStr)
        } catch (error) {
          console.error(`Error sending message to user ${odId}:`, error)
          // Remove failed connection
          this.sessions.delete(odId)
        }
      }
    }
  }

  /**
   * Send message to specific user
   */
  private sendToUser(session: UserSession, message: ChatMessage): void {
    // WebSocket.OPEN = 1 in Workers runtime
    if (session.websocket.readyState === 1) {
      try {
        session.websocket.send(JSON.stringify(message))
      } catch (error) {
        console.error(`Error sending message to user ${session.userId}:`, error)
      }
    }
  }

  /**
   * Send message history to user
   */
  private sendMessageHistory(session: UserSession): void {
    const historyMessage = {
      type: 'system' as const,
      userId: 'system',
      username: 'System',
      content: 'Recent messages',
      timestamp: Date.now(),
      messageId: crypto.randomUUID(),
      data: {
        type: 'history',
        messages: this.messageHistory.slice(-20) // Last 20 messages
      }
    }

    this.sendToUser(session, historyMessage)
  }

  /**
   * Sanitize message content to prevent XSS
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim()
  }

  /**
   * Get current room statistics
   */
  getRoomStats(): {
    roomId: string
    participantCount: number
    messageCount: number
    createdAt: number
    isPrivate: boolean
  } {
    return {
      roomId: this.state.roomId,
      participantCount: this.sessions.size,
      messageCount: this.messageHistory.length,
      createdAt: this.state.createdAt,
      isPrivate: this.state.isPrivate
    }
  }

  /**
   * Get list of current participants
   */
  getParticipants(): Array<{
    userId: string
    username: string
    joinedAt: number
    lastActivity: number
  }> {
    return Array.from(this.sessions.values()).map(session => ({
      userId: session.userId,
      username: session.username,
      joinedAt: session.joinedAt,
      lastActivity: session.lastActivity
    }))
  }

  /**
   * Set room as private with allowed users
   */
  async setPrivate(allowedUserIds: string[]): Promise<void> {
    this.state.isPrivate = true
    this.state.allowedUsers = new Set(allowedUserIds)
    await this.saveState()
  }

  /**
   * Set room as public
   */
  async setPublic(): Promise<void> {
    this.state.isPrivate = false
    this.state.allowedUsers = undefined
    await this.saveState()
  }

  /**
   * Clear message history
   */
  async clearHistory(): Promise<void> {
    this.messageHistory = []
    await this.saveState()
  }
}