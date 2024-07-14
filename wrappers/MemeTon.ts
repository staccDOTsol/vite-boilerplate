import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type MemeTonConfig = {
    id: number;
    counter: number;
};

export function memeTonConfigToCell(config: MemeTonConfig): Cell {
    return beginCell().storeUint(config.id, 32).storeUint(config.counter, 32).endCell();
}

export const Opcodes = {
    increase: 0x7e8764ef,
};

export class MemeTon implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MemeTon(address);
    }

    static createFromConfig(config: MemeTonConfig, code: Cell, workchain = 0) {
        const data = memeTonConfigToCell(config);
        const init = { code, data };
        return new MemeTon(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendIncrease(
        provider: ContractProvider,
        via: Sender,
        opts: {
            increaseBy: number;
            value: bigint;
            queryID?: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(3, 32) // op code for set_jetton_minter
                .storeUint(0, 64) // query_id
                // @ts-ignore
                .storeAddress(Address.parse("EQDJDqftf89BTR7YAedf2Ha_v0iZjRlmr08jM2wrUL0rAQxR"))
                .endCell(),
        });
    }

    async getTotalSupply(provider: ContractProvider) {
        const result = await provider.get('get_total_supply', []);
        return result.stack.readNumber();
    }
    async getPotSize(provider: ContractProvider) {
        const result = await provider.get('get_pot_size', []);
        return result.stack.readNumber();
    }
    async getLastBuyer(provider: ContractProvider) {
        const result = await provider.get('get_last_buyer', []);
        return result.stack.readAddress();
    }

    async getTimeLeft(provider: ContractProvider) {
        const result = await provider.get('get_time_left', []);
        return result.stack.readNumber();
    }

    async getKeyPrice(provider: ContractProvider) {
        const result = await provider.get('get_key_price', []);
        return result.stack.readBigNumber();
    }

    async buyKeys(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(1, 32) // op code for buy_keys
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }

    async burnKeys(
        provider: ContractProvider,
        via: Sender,
        opts: {
            keysToBurn: number;
            value: bigint;
            queryID?: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x595f07bc, 32) // op code for burn
                .storeUint(opts.queryID ?? 0, 64)
                .storeCoins(opts.keysToBurn)
                .endCell(),
        });
    }

    async claimWin(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryID?: number;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(2, 32) // op code for claim_win
                .storeUint(opts.queryID ?? 0, 64)
                .endCell(),
        });
    }
    async getID(provider: ContractProvider) {
        const result = await provider.get('get_id', []);
        return result.stack.readAddress();
    }
}
