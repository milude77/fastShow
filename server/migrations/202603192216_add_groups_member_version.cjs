exports.up = function(knex){
    return knex.schema.table('groups', function(table) {
        table.integer('member_version').defaultTo(0);
    });
}

exports.down = function(knex){
    return knex.schema.table('groups', function(table) {
        table.dropColumn('member_version');
    });
}