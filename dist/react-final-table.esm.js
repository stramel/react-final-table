import { useMemo, useReducer, useCallback, useEffect } from 'react';

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

var byTextAscending = function byTextAscending(getTextProperty) {
  return function (objectA, objectB) {
    var upperA = getTextProperty(objectA).toUpperCase();
    var upperB = getTextProperty(objectB).toUpperCase();

    if (upperA < upperB) {
      return -1;
    }

    if (upperA > upperB) {
      return 1;
    }

    return 0;
  };
};
var byTextDescending = function byTextDescending(getTextProperty) {
  return function (objectA, objectB) {
    var upperA = getTextProperty(objectA).toUpperCase();
    var upperB = getTextProperty(objectB).toUpperCase();

    if (upperA > upperB) {
      return -1;
    }

    if (upperA < upperB) {
      return 1;
    }

    return 0;
  };
};

var createReducer = function createReducer() {
  return function (state, action) {
    switch (action.type) {
      case 'SET_ROWS':
        var rows = [].concat(action.data); // preserve sorting if a sort is already enabled when data changes

        if (state.sortColumn) {
          rows = sortByColumn(action.data, state.sortColumn, state.columns);
        }

        if (state.paginationEnabled) {
          rows = getPaginatedData(rows, state.pagination.perPage, state.pagination.page);
        }

        return _extends({}, state, {
          rows: rows,
          originalRows: action.data
        });

      case 'NEXT_PAGE':
        var nextPage = state.pagination.page + 1;
        return _extends({}, state, {
          rows: getPaginatedData(state.originalRows, state.pagination.perPage, nextPage),
          pagination: _extends({}, state.pagination, {
            page: nextPage,
            canNext: nextPage * state.pagination.perPage < state.originalRows.length,
            canPrev: nextPage !== 1
          })
        });

      case 'PREV_PAGE':
        var prevPage = state.pagination.page === 1 ? 1 : state.pagination.page - 1;
        return _extends({}, state, {
          rows: getPaginatedData(state.originalRows, state.pagination.perPage, prevPage),
          pagination: _extends({}, state.pagination, {
            page: prevPage,
            canNext: prevPage * state.pagination.perPage < state.originalRows.length,
            canPrev: prevPage !== 1
          })
        });

      case 'TOGGLE_SORT':
        if (!(action.columnName in state.columnsByName)) {
          throw new Error("Invalid column, " + action.columnName + " not found");
        }

        var isAscending = null;
        var sortedRows = []; // loop through all columns and set the sort parameter to off unless
        // it's the specified column (only one column at a time for )

        var columnCopy = state.columns.map(function (column) {
          // if the row was found
          if (action.columnName === column.name) {
            if (action.isAscOverride !== undefined) {
              // force the sort order
              isAscending = action.isAscOverride;
            } else {
              // if it's undefined, start by setting to ascending, otherwise toggle
              isAscending = column.sorted.asc === undefined ? true : !column.sorted.asc;
            } // default to sort by string


            var columnCompareFn = column.sort || byTextAscending(function (object) {
              return object.original[action.columnName];
            });
            sortedRows = state.rows.sort(function (a, b) {
              var result = columnCompareFn(a, b);
              return isAscending ? result : result * -1;
            });
            return _extends({}, column, {
              sorted: {
                on: true,
                asc: isAscending
              }
            });
          } // set sorting to false for all other columns


          return _extends({}, column, {
            sorted: {
              on: false,
              asc: false
            }
          });
        });
        return _extends({}, state, {
          columns: columnCopy,
          rows: sortedRows,
          sortColumn: action.columnName,
          columnsByName: getColumnsByName(columnCopy)
        });

      case 'GLOBAL_FILTER':
        var filteredRows = action.filter(state.originalRows);
        var selectedRowsById = {};
        state.selectedRows.forEach(function (row) {
          selectedRowsById[row.id] = !!row.selected;
        });
        return _extends({}, state, {
          rows: filteredRows.map(function (row) {
            return selectedRowsById[row.id] ? _extends({}, row, {
              selected: selectedRowsById[row.id]
            }) : _extends({}, row);
          }),
          filterOn: true
        });

      case 'SELECT_ROW':
        var stateCopy = _extends({}, state);

        stateCopy.rows = stateCopy.rows.map(function (row) {
          var newRow = _extends({}, row);

          if (newRow.id === action.rowId) {
            newRow.selected = !newRow.selected;
          }

          return newRow;
        });
        stateCopy.originalRows = stateCopy.originalRows.map(function (row) {
          var newRow = _extends({}, row);

          if (newRow.id === action.rowId) {
            newRow.selected = !newRow.selected;
          }

          return newRow;
        });
        stateCopy.selectedRows = stateCopy.originalRows.filter(function (row) {
          return row.selected;
        });
        stateCopy.toggleAllState = stateCopy.selectedRows.length === stateCopy.rows.length;
        return stateCopy;

      case 'SEARCH_STRING':
        var stateCopySearch = _extends({}, state);

        stateCopySearch.rows = stateCopySearch.originalRows.filter(function (row) {
          return row.cells.filter(function (cell) {
            return cell.value.includes(action.searchString);
          }).length > 0;
        });
        return stateCopySearch;

      case 'TOGGLE_ALL':
        var stateCopyToggle = _extends({}, state);

        var rowIds = {};
        var selected = state.selectedRows.length < state.rows.length;
        stateCopyToggle.rows = stateCopyToggle.rows.map(function (row) {
          rowIds[row.id] = selected;
          return _extends({}, row, {
            selected: selected
          });
        });
        stateCopyToggle.toggleAllState = selected;
        stateCopyToggle.originalRows = stateCopyToggle.originalRows.map(function (row) {
          return row.id in rowIds ? _extends({}, row, {
            selected: rowIds[row.id]
          }) : _extends({}, row);
        });
        stateCopyToggle.selectedRows = stateCopyToggle.originalRows.filter(function (row) {
          return row.selected;
        });
        return stateCopyToggle;

      default:
        throw new Error('Invalid reducer action');
    }
  };
};

var useTable = function useTable(columns, data, options) {
  var columnsWithSorting = useMemo(function () {
    return columns.map(function (column) {
      return _extends({}, column, {
        label: column.label ? column.label : column.name,
        hidden: column.hidden ? column.hidden : false,
        sort: column.sort,
        sorted: {
          on: false
        }
      });
    });
  }, [columns]);
  var columnsByName = useMemo(function () {
    return getColumnsByName(columnsWithSorting);
  }, [columnsWithSorting]);
  var tableData = useMemo(function () {
    var sortedData = sortDataInOrder(data, columnsWithSorting);
    var newData = sortedData.map(function (row, idx) {
      return {
        id: idx,
        selected: false,
        hidden: false,
        original: row,
        cells: Object.entries(row).map(function (_ref) {
          var column = _ref[0],
              value = _ref[1];
          return {
            hidden: columnsByName[column].hidden,
            field: column,
            value: value,
            render: makeRender(value, columnsByName[column].render, row)
          };
        }).filter(function (cell) {
          return !cell.hidden;
        })
      };
    });
    return newData;
  }, [data, columnsWithSorting, columnsByName]);
  var reducer = createReducer();

  var _useReducer = useReducer(reducer, {
    columns: columnsWithSorting,
    columnsByName: columnsByName,
    originalRows: tableData,
    rows: tableData,
    selectedRows: [],
    toggleAllState: false,
    filterOn: !!(options != null && options.filter),
    sortColumn: null,
    paginationEnabled: !!(options != null && options.pagination),
    pagination: {
      page: 1,
      perPage: 10,
      canNext: true,
      canPrev: false,
      nextPage: function nextPage() {},
      prevPage: function prevPage() {}
    }
  }),
      state = _useReducer[0],
      dispatch = _useReducer[1];

  state.pagination.nextPage = useCallback(function () {
    dispatch({
      type: 'NEXT_PAGE'
    });
  }, [dispatch]);
  state.pagination.prevPage = useCallback(function () {
    return dispatch({
      type: 'PREV_PAGE'
    });
  }, [dispatch]);
  useEffect(function () {
    dispatch({
      type: 'SET_ROWS',
      data: tableData
    });
  }, [tableData]);
  var headers = useMemo(function () {
    return [].concat(state.columns.map(function (column) {
      var label = column.label ? column.label : column.name;
      return _extends({}, column, {
        render: makeHeaderRender(label, column.headerRender)
      });
    }));
  }, [state.columns]);
  var filter = options == null ? void 0 : options.filter;
  useEffect(function () {
    if (filter) {
      dispatch({
        type: 'GLOBAL_FILTER',
        filter: filter
      });
    }
  }, [filter]);
  return {
    headers: headers.filter(function (column) {
      return !column.hidden;
    }),
    rows: state.rows,
    originalRows: state.originalRows,
    selectedRows: state.selectedRows,
    dispatch: dispatch,
    selectRow: function selectRow(rowId) {
      return dispatch({
        type: 'SELECT_ROW',
        rowId: rowId
      });
    },
    toggleAll: function toggleAll() {
      return dispatch({
        type: 'TOGGLE_ALL'
      });
    },
    toggleSort: function toggleSort(columnName, isAscOverride) {
      return dispatch({
        type: 'TOGGLE_SORT',
        columnName: columnName,
        isAscOverride: isAscOverride
      });
    },
    setSearchString: function setSearchString(searchString) {
      return dispatch({
        type: 'SEARCH_STRING',
        searchString: searchString
      });
    },
    pagination: state.pagination,
    toggleAllState: state.toggleAllState
  };
};

var makeRender = function makeRender(value, render, row) {
  return render ? function () {
    return render({
      row: row,
      value: value
    });
  } : function () {
    return value;
  };
};

var makeHeaderRender = function makeHeaderRender(label, render) {
  return render ? function () {
    return render({
      label: label
    });
  } : function () {
    return label;
  };
};

var sortDataInOrder = function sortDataInOrder(data, columns) {
  return data.map(function (row) {
    var newRow = {};
    columns.forEach(function (column) {
      if (!(column.name in row)) {
        throw new Error("Invalid row data, " + column.name + " not found");
      }

      newRow[column.name] = row[column.name];
    });
    return newRow;
  });
};

var sortByColumn = function sortByColumn(data, sortColumn, columns) {
  var isAscending = null;
  var sortedRows = [].concat(data);
  columns.forEach(function (column) {
    // if the row was found
    if (sortColumn === column.name) {
      isAscending = column.sorted.asc; // default to sort by string

      var columnCompareFn = column.sort || byTextAscending(function (object) {
        return object.original[sortColumn];
      });
      sortedRows = data.sort(function (a, b) {
        var result = columnCompareFn(a, b);
        return isAscending ? result : result * -1;
      });
    }
  });
  return sortedRows;
};

var getColumnsByName = function getColumnsByName(columns) {
  var columnsByName = {};
  columns.forEach(function (column) {
    var col = {
      label: column.label
    };

    if (column.render) {
      col['render'] = column.render;
    }

    col['hidden'] = column.hidden;
    columnsByName[column.name] = col;
  });
  return columnsByName;
};

var getPaginatedData = function getPaginatedData(rows, perPage, page) {
  var start = (page - 1) * perPage;
  var end = start + perPage;
  return rows.slice(start, end);
};

export { byTextAscending, byTextDescending, useTable };
//# sourceMappingURL=react-final-table.esm.js.map
