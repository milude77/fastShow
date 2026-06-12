class Snowflake {
    constructor(machineId = 1) {
        this.machineId = BigInt(machineId) & 0x3FFn;
        this.sequence = 0n;
        this.lastTimestamp = 0n;
        this.epoch = 1700000000000n;
    }

    now() {
        return BigInt(Date.now());
    }

    waitNextMillis(lastTimestamp) {
        let timestamp = this.now() - this.epoch;
        while (timestamp <= lastTimestamp) {
            timestamp = this.now() - this.epoch;
        }
        return timestamp;
    }

    nextId() {
        let timestamp = this.now() - this.epoch;

        if (timestamp === this.lastTimestamp) {
            this.sequence = (this.sequence + 1n) & 0xFFFn;
            if (this.sequence === 0n) {
                timestamp = this.waitNextMillis(this.lastTimestamp);
            }
        } else {
            this.sequence = 0n;
        }

        this.lastTimestamp = timestamp;

        return (
            (timestamp << 22n) |
            (this.machineId << 12n) |
            this.sequence
        );
    }
}

export const snowflake = new Snowflake(1);
