import { ColumnType } from 'types';
declare const columns: ({
    name: string;
    hidden: boolean;
    label?: undefined;
    render?: undefined;
} | {
    name: string;
    label: string;
    hidden?: undefined;
    render?: undefined;
} | {
    name: string;
    label: string;
    render: ({ value }: {
        value: boolean;
    }) => "Yes" | "No";
    hidden?: undefined;
})[];
export declare type UserType = {
    id: number;
    isActive: boolean;
    age: number;
    eyeColor: string;
    firstName: string;
    lastName: string;
    company: string;
    email: string;
    phone: string;
    address: string;
};
export declare const makeData: <T extends Record<string, unknown>>(rowNum: number) => {
    columns: ColumnType<T>[];
    data: UserType[];
};
export declare const makeSimpleData: <T extends Record<string, any>>() => {
    columns: ColumnType<T>[];
    data: {
        firstName: string;
        lastName: string;
        birthDate: string;
    }[];
};
export {};
