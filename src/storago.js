/*"use strict";*/
var storago = {};
;(function(storago){

   //static property
   storago.debug = false;

   //local property
   var tables = [];
   var __tables2 = [];
   var __tables = tables;
   var __migrations = {};
   var __migrations_number = [0];

   //local function
   var Metadata = function(){
     this.dependents = {};
     this.parents = {};
     this.indexs = [];
   };

   //class Entry
   var Entry = function(name, prop){};
   Entry.prototype.rowid = null;
   var __Entry = Entry;

   Entry.prototype.save = function(cb, cbErr){

      var self = this;

      if(this.rowid == null){

         var insert = new query.Insert(this._TABLE);
         insert.add(this);
         storago.db.transaction(function(tx){
            insert.execute(tx, function(tx, result){
               self.rowid = result.insertId;
               if(cb) cb(self);

            },function(tx, err){
               if(cbErr){
                 cbErr(err);
               }else{
                 var msg = "(storago) " + err.message;
                 throw msg;
               }
            });
         });
      }else{

         var ondata = function(row){
            var data = row._DATA;
            var update = new query.Update(self._TABLE);

            for(var p in data){
               var self_p = tools.fieldToDb(null, self[p]);
               if(self_p != data[p]){
                  update.set(p, self[p]);
               }
            }
            update.where('rowid = ?', row.rowid);

            storago.db.transaction(function(tx){
               update.execute(tx, cb, function(tx, err){
                  var msg = "(storago) " + err.message;
                  throw msg;
               });
            });
         };

         if(!this._DATA){
            this._TABLE.find(this.rowid, ondata);
         }else{
            ondata(this);
         }
      }
   };

   Entry.prototype.delete = function(cb, errCb){

       var query = query.Delete(this._TABLE);
       query.where(this._TABLE.name + '.rowid = ?', this.rowid);

       storago.db.transaction(function(tx){
           query.execute(tx, cb, function(tx, err){
               if(errCb != undefined) return errCb(err);
               var msg = "(storago) " + err.message;
               throw msg;
           });
       });
   }

   Entry.prototype.refresh = function(cb){
      var self = this;
      this._TABLE.find(this.rowid, function(row){
         for(var p in row) self[p] = row[p];
         if(cb) cb();
      });
   };

   Entry.info = function(cb, cbErr){
       var self = this;
       storago.db.transaction(function(tx){
           var info = new query.Info(self);
           info.execute(tx, cb, cbErr);
       });
   };

   Entry.find = function(rowid, cb, cbErr){
     this.findBy('rowid', rowid, cb, cbErr);
   };

   Entry.findBy = function(col, value, cb, cbErr){
      var self = this;
      var select = this.select();
      select.where(this.META.name + '.' + col + ' = ?', value);
      select.one(cb, cbErr);
   };

   Entry.select = function(){
      var select = new query.Select(this);
      return select;
   };

   Entry.index = function(index){
      this.META.indexs.push(index);
   };

   Entry.hasMany = function(many_name, child_entry, name){
      this.META.dependents[many_name] = child_entry;
      child_entry.META.parents[name] = this;
      var self = this;
      var ref_column = name + '_id';

      //config child
      child_entry.prototype[name] = function(item, cbErr){

         if(typeof(item) == 'function'){// get mode

            self.find(this[ref_column], item, cbErr);
            return;

         }else if(typeof(item) == 'object'){ // set mode

            if(item._TABLE && item._TABLE.META.name == self.META.name){
              this[ref_column] = item.rowid;
              return;
            }else{
              var msg = "(storago) No permission: object must be of class(" + self.META.name + ")" ;
              msg += ", but is the class(" + item._TABLE.META.name + ")";
              throw msg;
           }
        }
     };

     //config parent
     Object.defineProperty(this.prototype, many_name, {
        get: function(){
           var select = child_entry.select();
           select.where(ref_column + ' = ?', this.rowid);
           return select;
        }
     });
   };

   //static function connect
   storago.connect = function(name, description, size){
      storago.db = openDatabase(name, '', description, size);
   };

   //static function define
   storago.define = function(name, props){

     var __meta = new Metadata();
     __meta.name = name;
     __meta.props = props;

     var row;
     eval("row = function " + name +"(){};");
     for(var i in __Entry) row[i] = __Entry[i]; //clone Entry

     row.META = __meta;
     row.prototype = new __Entry();
     row.prototype._TABLE = row;
     __tables.push(row);
     __tables2.push(row);

     return row;
   };

   storago.migration = function(number, migreFunc, migreErr){
       if(__migrations_number.indexOf(number) >= 0){
           throw "(storago) Migration " + number + " already exists";
       }
       __migrations_number.push(number);
       __migrations_number.sort(function(a, b){ a - b});
        __migrations[number] = [migreFunc, migreErr];
   }

   //static function schema
   storago.schema = function(cb){

      var ts = [];
      var self = this;

      var oncreate = function(tx, onCb){
         var table = __tables2.pop();

         if(table){
             var create = new query.Create(table);
             create.execute(tx, function(tx){
                 var index  = new query.Index(table);
                 index.execute(tx, function(tx){
                     oncreate(tx, onCb);
                     ts.push(table);
                 });
             });
         }else{
             return onCb();
         }
      }

      var migreTo = function(version, onCb){

          if(version && __migrations[version]){
              console.log(storago.db.version, version);
              storago.db.changeVersion(storago.db.version, String(version), function(t){
                  __migrations[version][0](t);
              }, function(err){
                  if(__migrations[version].hasOwnProperty(1)) return __migrations[version][1](err);
                  throw "(Storago) " + err.message;
              }, function(){
                 migreTo(__migrations_number.pop(), onCb);
              });
          }else{
              __migrations = {}; //clear migrations
              onCb();
          }
      }

     storago.db.transaction(function(tx){
        oncreate(tx, function(){
            var version = parseInt(storago.db.version) || '';
            if(version == ''){
                var db_version = __migrations_number[__migrations_number.length-1];
                storago.db.changeVersion('', db_version, undefined, undefined, cb);
            }else{
                var index = __migrations_number.indexOf(version);
                if(index < 0) throw "(storago) Version " + version + " no have on migration list";
                __migrations_number = __migrations_number.slice(index).reverse();
                __migrations_number.pop(); //Discart current version
                return migreTo(__migrations_number.pop(), cb);
            }

        });
     });
   };

   //static function reset
   storago.reset = function(cb){
      storago.db.transaction(function(tx){
         for(var t in tables){
            var table = tables[t];
            var drop = new query.Drop(table);
            drop.execute(tx, cb);
         }
      });
   };

   //package query
   var query = {};
   storago.query = query;

   //class query.Select
   var select = function(table){
      this.table = table;
      this._offset = null;
      this._limit = null;
      this._from = null;
      this._wheres = [];
      this._joins = [];
      this._columns = [];
      this._values = [];
      this._orders = [];
      this._groups = [];
      this._havings = [];
   }
   query.Select = select;

   select.prototype.limit = function(limit, offset){
      this._limit = limit;
      if(offset) this._offset = offset;
      return this;
   };

   select.prototype.order = function(col){
      if(col.search('ASC') < 0 && col.search('asc') < 0 &&
         col.search('DESC') < 0 && col.search('desc' < 0 )){
         col += ' ASC';
      }
      this._orders.push(col);
      return this;
   };

   select.prototype.where = function(where, data){
      if(!Array.isArray(data) && data != undefined) data = [data];
      this._wheres.push([where, data]);
      return this;
   };

   select.prototype.from = function(from, columns){
      this._from = from;
      if(columns == undefined) columns = ['*'];
      this._columns.push(from + '.rowid');
      for(var c in columns) this._columns.push(from + '.' + columns[c]);
      return this;
   };

   select.prototype.join = function(name, on, columns){

      if(columns == undefined) columns = [name + '*'];
      this._joins.push([name, on]);
      this._columns.concat(columns);
   };

   select.prototype.render = function(){

     this._values = [];
     if(this._from == null && this.table) this.from(this.table.META.name);

     var sql = 'SELECT';
     for(var c in this._columns){

        if(c == 0){
           sql += ' ';
        }else{
           sql += ', ';
        }
        sql += this._columns[c];
     }

     if(this._from != null) sql += ' FROM ' + this._from;

     if(this._joins.length){
        var size = this._joins.length;
        for(var j in this._joins){
           var join = this._joins[j];
           sql += ' JOIN ' + join[0] + ' ON ' + join[1];
        }
     }

     if(this._wheres.length){
        sql += ' WHERE ';
        for(var w in this._wheres){
           var where = this._wheres[w];
           sql += where[0];
           if((this._wheres.length - 1) != w) sql += ' AND ';
           var value = where[1];
           if(value != undefined) this._values = this._values.concat(value);
        }
     }

     if(this._orders.length){
        sql += ' ORDER BY ';
        for(var o in this._orders){
           sql += this._orders[o];
           if((this._orders.length - 1) != o) sql += ', ';
        }
     }

     if(this._limit != null)  sql += ' LIMIT ' + this._limit;
     if(this._offset != null) sql += ' OFFSET ' + this._offset;
     sql += ';';

     return sql;
   };

   select.prototype.toString = function(){
      return this.render();
   };

   select.prototype.execute = function(tx, cb, cbErr){
      var sql = this.render();
      if(storago.debug) console.log(sql, this._values);
      tx.executeSql(sql, this._values, cb, cbErr);
   };

   select.prototype.all = function(cb, cbErr){

      var rowset = [];
      var self = this;
      storago.db.transaction(function(tx){
         self.execute(tx, function(tx, result){
            var rows = result.rows;
            for(var r = 0; r < rows.length; r++){
               var row = rows.item(r);
               var table = self.table;
               var entry = new table();
               var props = self.table.META.props
               for(var p in row){
                   entry[p] = tools.dbToField(props[p], row[p]);
               }
               entry._DATA = row;
               rowset.push(entry);
            }
            if(storago.debug) console.log(rowset);
            if(typeof(cb) != 'function') throw "(storago) is not a function, " + typeof(cb) + " given";
            if(cb) cb(rowset);
            return;
         }, function(tx, err){
            if(cbErr){
               cbErr(err);
               return;
            }else{
               throw "(storago) " + err.message;
            }
         });
      });
   };

   select.prototype.one = function(cb, cbErr){

      this.limit(1);
      this.all(function(rowset){
         if(rowset.length == 0){ cb(null); return; };
         if(cb == undefined) throw "(storago) callback undefined";
         if(typeof(cb) != 'function') throw "(storago) is not a function, " + typeof(cb) + " given";
         cb(rowset[0]);
      }, cbErr);
   };

   // Private package tools
   var tools = {};
   tools.fieldToDb = function(type, value){

       if(value == undefined)    return null;
       if(value instanceof Date) return value.getIso();
       if(typeof(value) == 'function') throw 'Function seted like property: ' + value;
       return value;
   };

   tools.dbToField = function(type, value){

       if(value && (type == 'DATE' || type == 'DATETIME')) return new Date(value);
       return value;
   };

   //class query.Index
   var index = function(table){

       this.table = table;
       this.indexs = [];
   };
   query.Index = index;

   index.prototype.render = function(){

       var indexs = this.table.META.indexs;
       for(var i in indexs){
           var index = indexs[i];
           var sql = "CREATE INDEX IF NOT EXISTS ";
           sql+= index + "_idx ON ";
           sql += this.table.META.name + " (" + index + ");";
           this.indexs.push(sql);
       }
   };

   index.prototype.execute = function(tx, cb, cbErr){

       this.render();
       if(this.indexs.length == 0){
           cb(tx);
           return;
       }
       var self = this;

       var onindex = function(i){
           if(self.indexs.length == i){ cb(tx); return; };
           var index = self.indexs[i];
           if(storago.debug) console.log(index);
           tx.executeSql(index, null, function(){
               onindex(i+1);
           }, cbErr);
       };

       onindex(0);
   };

   //class query.Create
   var create = function(table){

      this.table = table;
      this.columns = [];
      this.indexs = [];
   };
   query.Create = create;

   create.prototype.parse = function(){

     for(var name in this.table.META.props){
        var type = this.table.META.props[name];
        this.columns.push(name + ' ' + type.toUpperCase());
     }

     for(var name in this.table.META.parents){
        this.columns.push(name + '_id NUMERIC');
     }
   };

   create.prototype.render = function(){

     this.parse();
     var sql = 'CREATE TABLE IF NOT EXISTS ' + this.table.META.name + '(';
     for(var c in this.columns){
       sql += this.columns[c];
       if((this.columns.length - 1) != c) sql += ', ';
     }
     sql += '); '

     return sql;
   };

   create.prototype.execute = function(tx, cb, cbErr){
      var sql = this.render();
      if(storago.debug) console.log(sql);
      tx.executeSql(sql, [], cb, cbErr);
   };

   //class query.Info
   var info = function(table){
       this.table = table;
   };
   query.Info = info;

   info.prototype.execute = function(tx, cb, cbErr){

      var sql = "PRAGMA table_info(\"" + this.table.META.name + "\")";
      if(storago.debug) console.log(sql);
      tx.executeSql(sql, [], function(rowset){
          var columns = {};
          for(var r in rowset){
              var row = rowset[r];
              columns[row.name] = row.type;
          };

          if(storago.debug) console.log(columns);
          cb(columns);

      }, cbErr);
   };

   //class query.Insert
   var insert = function(table){
     this.table = table;
     this.columns = [];
     this.objects = [];
     this.values = [];
   };
   query.Insert = insert;

   insert.prototype.add = function(obj){

     if(!obj._TABLE || obj._TABLE.META.name != this.table.META.name){
       var msg = "(storago) No permission: object must be of class(" + this.table.META.name + ")" ;
       msg += ", but is the class(" + obj._TABLE.META.name + ")";
       throw msg;
     }

     this.objects.push(obj);
   };

   insert.prototype.parse = function(){

      this.values = [];
      for(var prop in this.table.META.props) this.columns.push(prop);
      for(var parent in this.table.META.parents) this.columns.push(parent + '_id');
      for(var o in this.objects){
         var obj = this.objects[o];
         for(var c in this.columns){
            var column = this.columns[c];
            var type = this.table.META.props[column];
            this.values.push(tools.fieldToDb(type, obj[column]));
        }
      }
   };

   insert.prototype.render = function(){

      this.parse();
      var sql = 'INSERT INTO ' + this.table.META.name + ' (';

      for(var c in this.columns){
         sql += this.columns[c];
         if(c < this.columns.length-1) sql += ', ';
      }

      sql += ') VALUES (';

      for(var o in this.objects){
         var obj = this.objects[0];
         for(c in this.columns){
            var column = this.columns[c];
            sql += '?';
            if(c < this.columns.length-1) sql += ', ';
         }
         if(o < this.objects.length-1) sql += '), ';
      }

      sql += ')';
      return sql;
   };

   insert.prototype.execute = function(tx, cb, cbErr){

      var sql = this.render();
      if(storago.debug) console.log(sql, this.values);
      tx.executeSql(sql, this.values, cb, cbErr);
   };

   //class query.Delete
   var del = function(table){
      this.table = table;
      this.wheres = [];
      this.values = [];
   };
   query.Delete = del;

   del.prototype.where = function(where, value){

      if(!Array.isArray(value) && value != undefined) value = [value];
      this.wheres.push([where, value]);
   };

   del.prototype.render = function(){

     var props = this.table.META.props;

     this.values = [];

     var sql = 'DELETE FROM ' + this.table.META.name;

     if(this.wheres.length){
        sql += ' WHERE ';
        for(var w in this.wheres){
           var where = this.wheres[w];
           var value = tools.fieldToDb(props[where[0]], where[1]);
           if(value != undefined) this.values = this.values.concat(value);
           sql += where[0];
           if((this.wheres.length - 1) != w) sql += ' AND ';
        }
     }

     return sql;
   };

   del.prototype.execute = function(tx, cb, cbErr){

      var sql = this.render();
      if(sql == null){ if(cb) cb(tx); return; }
      if(storago.debug) console.log(sql, this.values);
      tx.executeSql(sql, this.values, cb, cbErr);
   };

   //class query.Update
   var update = function(table){

      this.table = table;
      this.wheres = [];
      this.columns = [];
      this.values = [];
   };
   query.Update = update;

   update.prototype.set = function(column, value){

      this.columns.push([column, value]);
   };

   update.prototype.render = function(){

      var props = this.table.META.props;

      this.values = [];
      if(this.columns.length == 0) return null;

      var sql = 'UPDATE ' + this.table.META.name + ' SET ';

      for(var c in this.columns){
         var column = this.columns[c];
         sql += column[0] + ' = ?';
         var value = tools.fieldToDb(props[column[0]], column[1]);
         this.values.push(value);
         if((this.columns.length - 1) != c) sql += ', ';
      }

      if(this.wheres.length){
         sql += ' WHERE ';
         for(var w in this.wheres){
            var where = this.wheres[w];
            var value = tools.fieldToDb(props[where[0]], where[1]);
            if(value != undefined) this.values = this.values.concat(value);
            sql += where[0];
            if((this.wheres.length - 1) != w) sql += ' AND ';
         }
      }

      return sql;
   };

   update.prototype.where = function(where, value){

      if(!Array.isArray(value) && value != undefined) value = [value];
      this.wheres.push([where, value]);
   };

   update.prototype.execute = function(tx, cb, cbErr){

      var sql = this.render();
      if(sql == null){ if(cb) cb(tx); return; }
      if(storago.debug) console.log(sql, this.values);
      tx.executeSql(sql, this.values, cb, cbErr);
   };

   //class query.Drop
   var drop = function(table){

      this.table = table;
   };
   query.Drop = drop;

   drop.prototype.execute = function(tx, cb, cbErr){
      var sql = 'DROP TABLE ' + this.table.META.name;
      if(storago.debug) console.log(sql);
      tx.executeSql(sql, [], cb, cbErr);
   };

   //class query.Truncate
   var truncate = function(table){

      this.table = table;
   };
   query.Truncate = truncate;

   truncate.prototype.execute = function(tx, cb, cbErr){

       var drop = new query.Drop(this.table);
       var create = new query.Create(this.table);
       drop.execute(tx, function(){
           create.execute(tx, cb, cbErr);
       }, cbErr);
   };

}(storago));
