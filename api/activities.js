const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {

    // 🔹 GET
    if (req.method === 'GET') {

        const { data, error } = await supabase
            .from('activities')
            .select(`
                *,
                users:created_by (id, username),
                activity_assignments (
                    id,
                    people (id, name, role)
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ success: false, error });
        }

        return res.json(data);
    }

    // 🔹 POST
    if (req.method === 'POST') {

        const { title, start_time, end_time, user_id } = req.body;

        if (!title || !start_time || !end_time || !user_id) {
            return res.status(400).json({ success: false });
        }

        const { data: activity, error } = await supabase
            .from('activities')
            .insert([{
                title,
                start_time,
                end_time,
                status: 'pending',
                created_by: user_id
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ success: false, error });
        }

        return res.json({ success: true, activity });
    }

    // 🔹 DELETE
    if (req.method === 'DELETE') {

        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ success: false });
        }

        await supabase.from('activity_assignments').delete().eq('activity_id', id);
        await supabase.from('activity_logs').delete().eq('activity_id', id);
        await supabase.from('activity_history').delete().eq('activity_id', id);

        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(500).json({ success: false, error });
        }

        return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};