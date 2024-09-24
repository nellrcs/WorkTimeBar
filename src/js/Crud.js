const sqlite3 = require('sqlite3').verbose()
module.exports = class Crud {
    constructor(dir) {
        this.db = new sqlite3.Database(dir +'/database.db', sqlite3.SQLITE_OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
              console.error(err.message);
            }
            console.log('Connected to database.');
          });

         this.createDatebase(); 
         this.selectAll();
    }

    close(){
        this.db.close();
    }

    createDatebase(){
        this.db.run("CREATE TABLE IF NOT EXISTS progress (id TEXT NOT NULL,title TEXT,totalTimeSeconds INTEGER NOT NULL,totalTimeFloat REAL NOT NULL,totalProgress INTEGER NOT NULL,totalTimePause INTEGER NOT NULL,currentTimePause INTEGER NOT NULL,lastTimestempPlay INTEGER NOT NULL,lastTimestempPause INTEGER NOT NULL,active NUMERIC);");
    };

    insertvalues(){
        this.run('INSERT INTO progress (id,title,totalTimeSeconds,totalTimeFloat,totalProgress,totalTimePause,currentTimePause,lastTimestempPlay,lastTimestempPause,active) VALUES (?,?,?,?,?,?,?,?,?,?)', ['id','title',100,1.1,100,100,100,100,100,0], (err) => {
        if(err) {
            return console.log(err.message); 
        }
        console.log('Row was added to the table:');
        });
    }

    update(data){
        this.db.run('UPDATE progress SET totalTimeSeconds = ?, totalTimeFloat = ? , totalProgress = ? WHERE id = ?,totalTimePause = ?, currentTimePause = ?, lastTimestempPlay = ?, lastTimestempPause = ?, active = ? ', data, function(err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Row(s) updated: ${this.changes}`);
        });
    }

    async deleteRowId(id) {
        this.db.run('DELETE FROM progress WHERE id = ?', [id], function (err) {
          if (err) {
            return console.error(err.message);
          }
          console.log(`Row with the ID ${id} has been deleted`);
        });
      }
    
    async clearDatabase(){
        this.db.run('DELETE FROM progress', [], function (err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Row with the ID ${id} has been deleted`);
        });
    }

    selectAll(){
        this.db.each("SELECT * FROM progress ", (err, row) => {

        if (err) {
            return console.error(err.message);
            } 
            console.log(row.id);
        });
    }


}


