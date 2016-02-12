var storago = {};
;(function(storago){

   //static property
   storago.debug = false;

   //local property
   var tables = [];
   var __tables = tables;

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
                 var msg = "(storago) " + err;
                 throw msg;
               }
            });
         });
      }else{

         var ondata = function(row){
            var data = row._DATA;
            var update = new query.Update(self._TABLE);

            for(var p in data){
               if(self[p] != data[p]){
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

   Entry.prototype.refresh = function(cb){
      var self = this;
      this._TABLE.find(this.rowid, function(row){
         for(var p in row) self[p] = row[p];
         if(cb) cb();
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
      child_entry.prototype[name] = function(item){

         if(typeof(item) == 'function'){// get mode

            self.find(this[ref_column], item);
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
   storago.connect = function(name, version, description, size){
      storago.db = openDatabase(name, version, description, size);
   };

   //static function define
   storago.define = function(name, props){

     var __meta = new Metadata();
     __meta.name = name;
     __meta.props = props;

     eval("var row = function " + name +"(){};");
     for(var i in __Entry) row[i] = __Entry[i]; //clone Entry

     row.META = __meta;
     row.prototype = new __Entry();
     row.prototype._TABLE = row;
     __tables.push(row);

     return row;
   };

   //static function schema
   storago.schema = function(cb){

      var oncreate = function(i, tx){

         if(i > (tables.length-1)){
            if(cb) cb();
            return;
         }
         var table = tables[i];
         var create = new query.Create(table);
         var index  = new query.Index(table);
         create.execute(tx, function(tx){
             index.execute(tx, function(tx){
                 oncreate(i+1, tx);
             });
         });
      }

     storago.db.transaction(function(tx){
        oncreate(0, tx);
     });
   };

   //static function reset
   storago.reset = function(){
      storago.db.transaction(function(tx){
         for(var t in tables){
            var table = tables[t];
            var drop = new query.Drop(table);
            drop.execute(tx);
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

   select.prototype.render = function(){

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

     if(this._wheres.length){
        sql += ' WHERE ';
        for(var w in this._wheres){
           var where = this._wheres[w];
           sql += where[0];
           if((this._wheres.length - 1) != w) sql += ' AND ';

           var value = where[1];
           if(value != undefined) this._values.push(value);
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

       if(type == 'DATE') return new Date(value);
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
       if(this.indexs.length == 0) cb(tx);
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
         for(c in this.columns){
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
            if(value != undefined) this.values.push(value);
            sql += where[0];
            if((this.wheres.length - 1) != w) sql += ' AND ';
         }
      }

      return sql;
   };

   update.prototype.where = function(where, value){

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
      tx.executeSql(sql, cb, cbErr);
   };

}(storago));
