const bcrypt = require('bcrypt');
const saltRounds = 10;
const password = 'password123';

bcrypt.hash(password, saltRounds, function (err, hash) {
    if (err) console.error(err);
    else console.log(hash);
});
