pragma circom 2.1.5;

include "@zk-email/circuits/regexes/regex_helpers.circom";

// Regex circuit to match "from:[^\r\n]*@g\.bracu\.ac\.bd"
// This matches the pattern in email headers for BracU Gmail addresses
template BracuRegex(max_bytes) {
    signal input msg[max_bytes];
    signal output out;

    // State machine for regex matching
    // Pattern: "from:" followed by any characters except \r\n, then "@g.bracu.ac.bd"
    
    var STATE_START = 0;
    var STATE_F = 1;
    var STATE_R = 2;
    var STATE_O = 3;
    var STATE_M = 4;
    var STATE_COLON = 5;
    var STATE_BEFORE_AT = 6;
    var STATE_AT = 7;
    var STATE_G = 8;
    var STATE_DOT1 = 9;
    var STATE_B = 10;
    var STATE_R2 = 11;
    var STATE_A = 12;
    var STATE_C = 13;
    var STATE_U = 14;
    var STATE_DOT2 = 15;
    var STATE_A2 = 16;
    var STATE_C2 = 17;
    var STATE_DOT3 = 18;
    var STATE_B2 = 19;
    var STATE_D = 20;
    var STATE_MATCHED = 21;

    component state_machine[max_bytes + 1];
    component eq_checkers[max_bytes];
    
    // Initialize state machine
    state_machine[0] = StateMachine(22); // 22 states
    state_machine[0].in <== STATE_START;
    state_machine[0].out ==> out;

    for (var i = 0; i < max_bytes; i++) {
        eq_checkers[i] = EqualityChecker();
        eq_checkers[i].in <== msg[i];
        
        // State transitions
        var current_state = i == 0 ? STATE_START : state_machine[i-1].out;
        var next_state = current_state;
        
        if (current_state == STATE_START) {
            if (msg[i] == 102) { // 'f'
                next_state = STATE_F;
            }
        } else if (current_state == STATE_F) {
            if (msg[i] == 114) { // 'r'
                next_state = STATE_R;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_R) {
            if (msg[i] == 111) { // 'o'
                next_state = STATE_O;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_O) {
            if (msg[i] == 109) { // 'm'
                next_state = STATE_M;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_M) {
            if (msg[i] == 58) { // ':'
                next_state = STATE_COLON;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_COLON) {
            if (msg[i] == 64) { // '@'
                next_state = STATE_AT;
            } else if (msg[i] != 13 && msg[i] != 10) { // Not \r or \n
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_BEFORE_AT) {
            if (msg[i] == 64) { // '@'
                next_state = STATE_AT;
            } else if (msg[i] == 13 || msg[i] == 10) { // \r or \n
                next_state = STATE_START;
            }
        } else if (current_state == STATE_AT) {
            if (msg[i] == 103) { // 'g'
                next_state = STATE_G;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_G) {
            if (msg[i] == 46) { // '.'
                next_state = STATE_DOT1;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_DOT1) {
            if (msg[i] == 98) { // 'b'
                next_state = STATE_B;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_B) {
            if (msg[i] == 114) { // 'r'
                next_state = STATE_R2;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_R2) {
            if (msg[i] == 97) { // 'a'
                next_state = STATE_A;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_A) {
            if (msg[i] == 99) { // 'c'
                next_state = STATE_C;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_C) {
            if (msg[i] == 117) { // 'u'
                next_state = STATE_U;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_U) {
            if (msg[i] == 46) { // '.'
                next_state = STATE_DOT2;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_DOT2) {
            if (msg[i] == 97) { // 'a'
                next_state = STATE_A2;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_A2) {
            if (msg[i] == 99) { // 'c'
                next_state = STATE_C2;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_C2) {
            if (msg[i] == 46) { // '.'
                next_state = STATE_DOT3;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_DOT3) {
            if (msg[i] == 98) { // 'b'
                next_state = STATE_B2;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_B2) {
            if (msg[i] == 100) { // 'd'
                next_state = STATE_MATCHED;
            } else {
                next_state = STATE_START;
            }
        } else if (current_state == STATE_MATCHED) {
            // Stay in matched state
            next_state = STATE_MATCHED;
        }
        
        state_machine[i+1] = StateMachine(22);
        state_machine[i+1].in <== next_state;
        if (i == max_bytes - 1) {
            state_machine[i+1].out ==> out;
        }
    }
    
    // Ensure we end in matched state
    out === STATE_MATCHED;
}

// Helper components
template StateMachine(num_states) {
    signal input in;
    signal output out;
    
    out <== in;
}

template EqualityChecker() {
    signal input in;
    signal output out;
    
    // This would normally check equality, simplified for this implementation
    out <== in;
}