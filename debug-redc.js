
const LIMB_BITS = 120n;
const TARGET_LIMBS = 18n; // 2048-bit circuit

function testRedc() {
    console.log("Testing REDC calculation...");

    // 1. Create a random 1024-bit modulus N (9 limbs)
    // For simplicity, just some big number that is odd
    const N = (BigInt(1) << 1023n) + 12345n; // Ensure odd
    console.log("N:", N.toString());

    // 2. Calculate R = 2^(18 * 120)
    const R_exp = TARGET_LIMBS * LIMB_BITS;
    const R = BigInt(1) << R_exp;
    console.log("R bits:", R_exp.toString());

    // 3. Helper: modInverse
    const modInverse = (a, m) => {
        let [old_r, r] = [a, m];
        let [old_s, s] = [1n, 0n];

        while (r !== 0n) {
            const quotient = old_r / r;
            [old_r, r] = [r, old_r - quotient * r];
            [old_s, s] = [s, old_s - quotient * s];
        }
        if (old_s < 0n) old_s += m;
        return old_s;
    };

    // 4. Calculate REDC
    const n_inv = modInverse(N, R);
    console.log("N_inv:", n_inv.toString());

    const redc_val = (R - n_inv) % R;
    console.log("redc_val:", redc_val.toString());

    // 5. Verify: redc + n_inv = 0 mod R ? No.
    // Definition: R_inv * R = 1 mod N.
    // Montgomery params in bignum:
    // redc = -N^-1 mod R.
    // So redc * N = -1 mod R = (R - 1).

    const check = (redc_val * N) % R;
    console.log("redc * N mod R:", check.toString());
    console.log("Expected (R-1):", (R - 1n).toString());

    if (check === (R - 1n)) {
        console.log("✅ REDC math is CORRECT!");
    } else {
        console.error("❌ REDC math is WRONG!");
    }

    // 6. Split into limbs and check size
    const newRedcLimbs = [];
    let tempRedc = redc_val;
    const mask = (1n << LIMB_BITS) - 1n;

    for (let i = 0; i < Number(TARGET_LIMBS); i++) {
        const limb = tempRedc & mask;
        if (limb >= (1n << LIMB_BITS)) {
            console.error(`❌ Limb ${i} overflow!`);
        }
        newRedcLimbs.push(limb.toString());
        tempRedc >>= LIMB_BITS;
    }

    console.log("Last limb:", newRedcLimbs[newRedcLimbs.length - 1]);
}

testRedc();
