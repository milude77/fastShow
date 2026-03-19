exports.up = function (knex) {
    return knex.schema.alterTable('users', function (table) {
        table.integer('inf_version').defaultTo(0).comment('用户信息版本号');
        table.integer('contact_list_version').defaultTo(0).comment('用户联系人列表版本号');
    })
}

exports.down = function (knex) {
    return knex.schema.alterTable('users', function (table) {
        table.dropColumn('inf_version');
        table.dropColumn('contact_list_version');
    })
}