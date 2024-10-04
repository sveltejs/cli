import { mysqlTable, serial, text, int } from "drizzle-orm/mysql-core";

export const user = mysqlTable('user', {
    id: serial('id').primaryKey(),
    age: int('age'),
});
