exports.up = function (knex) {
    return knex.schema.table('groups', function (table) {
        table.integer('message_version').defaultTo(0);
    })
}

exports.down = function (knex) {
    return knex.schema.table('groups', function (table) {
        table.dropColumn('message_version');
    })
}
