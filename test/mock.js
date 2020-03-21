/**
 * Generates the same position from position[0] with a random ply since last capture
 * @returns {String} a fen string with a random halfmove since capture (this is illegal)
 */
function gen_fen() { return `r2q1k1r/p2p1pp1/2n4p/2pQP1b1/2N5/2N5/PP3PPP/R3K2R w KQ - 1 ${Math.ceil(Math.random() * 9999)}` }

module.exports = {
    gen_fen
}