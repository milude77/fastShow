exports.up = async function (knex) {

    // =========================
    // users sequence
    // =========================

    await knex.raw(`
        CREATE SEQUENCE IF NOT EXISTS user_id_seq
        START WITH 100000
    `);

    // 获取当前 users 最大 id

    const userResult = await knex('users')
        .max('id as maxId')
        .first();

    const maxUserId = parseInt(
        userResult.maxId || '99999',
        10
    );

    // 设置 sequence 当前值

    await knex.raw(`
        SELECT setval(
            'user_id_seq',
            ?
        )
    `, [maxUserId]);



    // =========================
    // groups sequence
    // =========================

    await knex.raw(`
        CREATE SEQUENCE IF NOT EXISTS group_id_seq
        START WITH 100000
    `);

    // 获取当前 groups 最大 id

    const groupResult = await knex('groups')
        .max('id as maxId')
        .first();

    const maxGroupId = parseInt(
        groupResult.maxId || '99999',
        10
    );

    // 设置 sequence 当前值

    await knex.raw(`
        SELECT setval(
            'group_id_seq',
            ?
        )
    `, [maxGroupId]);
};

exports.down = async function (knex) {

    await knex.raw(`
        DROP SEQUENCE IF EXISTS user_id_seq
    `);

    await knex.raw(`
        DROP SEQUENCE IF EXISTS group_id_seq
    `);
};