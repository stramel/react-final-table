import { useMemo, useReducer, useEffect, ReactNode, useCallback } from 'react';

import {
  ColumnByNamesType,
  ColumnType,
  TableState,
  TableAction,
  DataType,
  UseTableReturnType,
  UseTableOptionsType,
  RowType,
  HeaderType,
  HeaderRenderType,
  ColumnStateType,
} from './types';
import { byTextAscending } from './utils';

const createReducer = <T extends DataType>() => (
  state: TableState<T>,
  action: TableAction<T>
): TableState<T> => {
  switch (action.type) {
    case 'SET_ROWS':
      let rows = [...action.data];
      // preserve sorting if a sort is already enabled when data changes
      if (state.sortColumn) {
        rows = sortByColumn(action.data, state.sortColumn, state.columns);
      }

      if (state.paginationEnabled) {
        rows = getPaginatedData(
          rows,
          state.pagination.perPage,
          state.pagination.page
        );
      }

      return {
        ...state,
        rows,
        originalRows: action.data,
      };

    case 'NEXT_PAGE':
      const nextPage = state.pagination.page + 1;
      return {
        ...state,
        rows: getPaginatedData(
          state.originalRows,
          state.pagination.perPage,
          nextPage
        ),
        pagination: {
          ...state.pagination,
          page: nextPage,
          canNext:
            nextPage * state.pagination.perPage < state.originalRows.length,
          canPrev: nextPage !== 1,
        },
      };
    case 'PREV_PAGE':
      const prevPage =
        state.pagination.page === 1 ? 1 : state.pagination.page - 1;

      return {
        ...state,
        rows: getPaginatedData(
          state.originalRows,
          state.pagination.perPage,
          prevPage
        ),
        pagination: {
          ...state.pagination,
          page: prevPage,
          canNext:
            prevPage * state.pagination.perPage < state.originalRows.length,
          canPrev: prevPage !== 1,
        },
      };
    case 'TOGGLE_SORT':
      if (!(action.columnName in state.columnsByName)) {
        throw new Error(`Invalid column, ${action.columnName} not found`);
      }

      let isAscending: boolean | null = null;

      let sortedRows: RowType<T>[] = [];

      // loop through all columns and set the sort parameter to off unless
      // it's the specified column (only one column at a time for )
      const columnCopy = state.columns.map(column => {
        // if the row was found
        if (action.columnName === column.name) {
          if (action.isAscOverride !== undefined) {
            // force the sort order
            isAscending = action.isAscOverride;
          } else {
            // if it's undefined, start by setting to ascending, otherwise toggle
            isAscending =
              column.sorted.asc === undefined ? true : !column.sorted.asc;
          }

          // default to sort by string
          const columnCompareFn =
            column.sort ||
            byTextAscending(object => object.original[action.columnName]);
          sortedRows = state.rows.sort((a, b) => {
            const result = columnCompareFn(a, b);
            return isAscending ? result : result * -1;
          });

          return {
            ...column,
            sorted: {
              on: true,
              asc: isAscending,
            },
          };
        }
        // set sorting to false for all other columns
        return {
          ...column,
          sorted: {
            on: false,
            asc: false,
          },
        };
      });

      return {
        ...state,
        columns: columnCopy,
        rows: sortedRows,
        sortColumn: action.columnName,
        columnsByName: getColumnsByName(columnCopy),
      };
    case 'GLOBAL_FILTER':
      const filteredRows = action.filter(state.originalRows);
      const selectedRowsById: { [key: number]: boolean } = {};
      state.selectedRows.forEach(row => {
        selectedRowsById[row.id] = !!row.selected;
      });

      return {
        ...state,
        rows: filteredRows.map(row => {
          return selectedRowsById[row.id]
            ? { ...row, selected: selectedRowsById[row.id] }
            : { ...row };
        }),
        filterOn: true,
      };
    case 'SELECT_ROW':
      const stateCopy = { ...state };

      stateCopy.rows = stateCopy.rows.map(row => {
        const newRow = { ...row };
        if (newRow.id === action.rowId) {
          newRow.selected = !newRow.selected;
        }
        return newRow;
      });

      stateCopy.originalRows = stateCopy.originalRows.map(row => {
        const newRow = { ...row };
        if (newRow.id === action.rowId) {
          newRow.selected = !newRow.selected;
        }
        return newRow;
      });

      stateCopy.selectedRows = stateCopy.originalRows.filter(
        row => row.selected
      );

      stateCopy.toggleAllState =
        stateCopy.selectedRows.length === stateCopy.rows.length;

      return stateCopy;
    case 'SEARCH_STRING':
      const stateCopySearch = { ...state };
      stateCopySearch.rows = stateCopySearch.originalRows.filter(
        row =>
          row.cells.filter(cell => cell.value.includes(action.searchString))
            .length > 0
      );
      return stateCopySearch;
    case 'TOGGLE_ALL':
      const stateCopyToggle = { ...state };
      const rowIds: { [key: number]: boolean } = {};

      const selected = state.selectedRows.length < state.rows.length;
      stateCopyToggle.rows = stateCopyToggle.rows.map(row => {
        rowIds[row.id] = selected;
        return { ...row, selected };
      });

      stateCopyToggle.toggleAllState = selected;

      stateCopyToggle.originalRows = stateCopyToggle.originalRows.map(row => {
        return row.id in rowIds
          ? { ...row, selected: rowIds[row.id] }
          : { ...row };
      });

      stateCopyToggle.selectedRows = stateCopyToggle.originalRows.filter(
        row => row.selected
      );

      return stateCopyToggle;
    default:
      throw new Error('Invalid reducer action');
  }
};

export const useTable = <T extends DataType>(
  columns: ColumnType<T>[],
  data: T[],
  options?: UseTableOptionsType<T>
): UseTableReturnType<T> => {
  const columnsWithSorting: ColumnStateType<T>[] = useMemo(
    () =>
      columns.map(column => {
        return {
          ...column,
          label: column.label ? column.label : column.name,
          hidden: column.hidden ? column.hidden : false,
          sort: column.sort,
          sorted: {
            on: false,
          },
        };
      }),
    [columns]
  );
  const columnsByName = useMemo(() => getColumnsByName(columnsWithSorting), [
    columnsWithSorting,
  ]);

  const tableData: RowType<T>[] = useMemo(() => {
    const sortedData = sortDataInOrder(data, columnsWithSorting);

    const newData = sortedData.map((row, idx) => {
      return {
        id: idx,
        selected: false,
        hidden: false,
        original: row,
        cells: Object.entries(row)
          .map(([column, value]) => {
            return {
              hidden: columnsByName[column].hidden,
              field: column,
              value: value,
              render: makeRender(value, columnsByName[column].render, row),
            };
          })
          .filter(cell => !cell.hidden),
      };
    });
    return newData;
  }, [data, columnsWithSorting, columnsByName]);

  const reducer = createReducer<T>();

  const [state, dispatch] = useReducer(reducer, {
    columns: columnsWithSorting,
    columnsByName: columnsByName,
    originalRows: tableData,
    rows: tableData,
    selectedRows: [],
    toggleAllState: false,
    filterOn: !!options?.filter,
    sortColumn: null,
    paginationEnabled: !!options?.pagination,
    pagination: {
      page: 1,
      perPage: 10,
      canNext: true,
      canPrev: false,
      nextPage: () => {},
      prevPage: () => {},
    },
  });

  state.pagination.nextPage = useCallback(() => {
    dispatch({ type: 'NEXT_PAGE' });
  }, [dispatch]);
  state.pagination.prevPage = useCallback(
    () => dispatch({ type: 'PREV_PAGE' }),
    [dispatch]
  );

  useEffect(() => {
    dispatch({ type: 'SET_ROWS', data: tableData });
  }, [tableData]);

  const headers: HeaderType<T>[] = useMemo(() => {
    return [
      ...state.columns.map(column => {
        const label = column.label ? column.label : column.name;
        return {
          ...column,
          render: makeHeaderRender(label, column.headerRender),
        };
      }),
    ];
  }, [state.columns]);

  const filter = options?.filter;
  useEffect(() => {
    if (filter) {
      dispatch({ type: 'GLOBAL_FILTER', filter });
    }
  }, [filter]);

  return {
    headers: headers.filter(column => !column.hidden),
    rows: state.rows,
    originalRows: state.originalRows,
    selectedRows: state.selectedRows,
    dispatch,
    selectRow: (rowId: number) => dispatch({ type: 'SELECT_ROW', rowId }),
    toggleAll: () => dispatch({ type: 'TOGGLE_ALL' }),
    toggleSort: (columnName: string, isAscOverride?: boolean) =>
      dispatch({ type: 'TOGGLE_SORT', columnName, isAscOverride }),
    setSearchString: (searchString: string) =>
      dispatch({ type: 'SEARCH_STRING', searchString }),
    pagination: state.pagination,
    toggleAllState: state.toggleAllState,
  };
};

const makeRender = <T extends DataType>(
  value: any,
  render: (({ value, row }: { value: any; row: T }) => ReactNode) | undefined,
  row: T
) => {
  return render ? () => render({ row, value }) : () => value;
};

const makeHeaderRender = (
  label: string,
  render: HeaderRenderType | undefined
) => {
  return render ? () => render({ label }) : () => label;
};

const sortDataInOrder = <T extends DataType>(
  data: T[],
  columns: ColumnType<T>[]
): T[] => {
  return data.map((row: any) => {
    const newRow: any = {};
    columns.forEach(column => {
      if (!(column.name in row)) {
        throw new Error(`Invalid row data, ${column.name} not found`);
      }
      newRow[column.name] = row[column.name];
    });
    return newRow;
  });
};

const sortByColumn = <T extends DataType>(
  data: RowType<T>[],
  sortColumn: string,
  columns: ColumnStateType<T>[]
): RowType<T>[] => {
  let isAscending: boolean | null | undefined = null;
  let sortedRows: RowType<T>[] = [...data];

  columns.forEach(column => {
    // if the row was found
    if (sortColumn === column.name) {
      isAscending = column.sorted.asc;

      // default to sort by string
      const columnCompareFn =
        column.sort || byTextAscending(object => object.original[sortColumn]);
      sortedRows = data.sort((a, b) => {
        const result = columnCompareFn(a, b);
        return isAscending ? result : result * -1;
      });
    }
  });

  return sortedRows;
};

const getColumnsByName = <T extends DataType>(
  columns: ColumnType<T>[]
): ColumnByNamesType<T> => {
  const columnsByName: ColumnByNamesType<T> = {};
  columns.forEach(column => {
    const col: any = {
      label: column.label,
    };

    if (column.render) {
      col['render'] = column.render;
    }
    col['hidden'] = column.hidden;
    columnsByName[column.name] = col;
  });

  return columnsByName;
};

const getPaginatedData = <T extends DataType>(
  rows: RowType<T>[],
  perPage: number,
  page: number
) => {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return rows.slice(start, end);
};
