import { ColumnType, UseTableReturnType, UseTableOptionsType } from './types';
export declare const useTable: <T extends Record<string, any>>(columns: ColumnType<T>[], data: T[], options?: UseTableOptionsType<T> | undefined) => UseTableReturnType<T>;
