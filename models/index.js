const { usersTable } = require("./usersMOdel");
const { passwordChangeHistoryTable } = require("./usersMOdel");
const { resetPasswordTable } = require("./usersMOdel");

//boiler: const {} = require("")
// otherwise we will not able to use index
module.exports = { usersTable, passwordChangeHistoryTable, resetPasswordTable };
