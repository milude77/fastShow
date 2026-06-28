exports.up = async (knex) => {
    return await knex.schema.table('user_devices', (table) => {
        table.dropUnique('device_id');
        table.unique(['device_id', 'user_id']);
    });
};

exports.down = async (knex) => {
    return await knex.schema.table('user_devices', (table) => {
        table.dropUnique(['device_id', 'user_id']);
        table.unique('device_id');
    });
};
