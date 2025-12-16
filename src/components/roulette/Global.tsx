
export const ValueType = {
    NUMBER: 0,
    NUMBERS_1_12: 1,
    NUMBERS_2_12: 2,
    NUMBERS_3_12: 3,
    NUMBERS_1_18: 4,
    NUMBERS_19_36: 5,
    EVEN: 6,
    ODD: 7,
    RED: 8,
    BLACK: 9,
    DOUBLE_SPLIT: 10,
    QUAD_SPLIT: 11,
    TRIPLE_SPLIT: 12,
    EMPTY: 13
} as const;

export type ValueType = typeof ValueType[keyof typeof ValueType];

export interface Item {
    type: ValueType;
    value: number;
    valueSplit: number[];
}


export interface PlacedChip {
    item: Item;
    sum: number;
}
export type rouletteData = {
    numbers: number[];
};
// Simplified state for single player
export type RouletteWrapperState = {
    rouletteData: rouletteData;
    number: WheelNumber;
    chipsData: ChipsData;
    winners: Winner[],
    username: string;
    endTime: number;
    progressCountdown: number;
    time_remaining: number;
    stage: GameStages;
    history: number[]
};
export type Winner = {
    username: string;
    sum: number;
}
export type ChipsData = {
    selectedChip: any;
    placedChips: any;
};

export type WheelNumber = {
    next: any;
};

export const GameStages = {
    PLACE_BET: 0,
    NO_MORE_BETS: 1,
    WINNERS: 2,
    NONE: 3
} as const;

export type GameStages = typeof GameStages[keyof typeof GameStages];
export type GameData = {
    stage: GameStages,
    time_remaining: number;
    value: number;
    wins: Winner[],
    history: number[]
}
