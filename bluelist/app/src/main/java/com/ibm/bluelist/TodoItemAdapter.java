package com.ibm.bluelist;

import android.content.Context;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Adapter;
import android.widget.BaseAdapter;
import android.widget.ImageButton;
import android.widget.ListAdapter;
import android.widget.TextView;

import com.cloudant.sync.datastore.DocumentRevision;

import java.util.List;

/**
 * An an adapter for mapping TodoItems to ListView rows
 */
public class TodoItemAdapter extends BaseAdapter implements ListAdapter{

    private static final String TAG = TodoItemAdapter.class.getCanonicalName();
    private List<DocumentRevision> mTodoItems;
    private Context mContext;

    public TodoItemAdapter(Context context, List<DocumentRevision> todoItems) {
        mContext = context;
        mTodoItems = todoItems;
    }

    /**
     * @see android.widget.Adapter#getCount()
     */
    @Override
    public int getCount() {
        return mTodoItems.size();
    }

    /**
     * @see android.widget.Adapter#getItem(int)
     */
    @Override
    public Object getItem(int position) {
        return mTodoItems.get(position);
    }

    /**
     * @see android.widget.Adapter#getItemId(int)
     */
    @Override
    public long getItemId(int position) {
        return position;
    }

    /**
     * @see android.widget.Adapter#getView(int, View, ViewGroup)
     */
    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        if (convertView == null) {
            // Inflate ListView row layout
            LayoutInflater inflater = (LayoutInflater) mContext.getSystemService(Context.LAYOUT_INFLATER_SERVICE);
            convertView = inflater.inflate(R.layout.listview_layout, parent, false);
        }

        // Get Views from layout
        ImageButton button = (ImageButton) convertView.findViewById(R.id.priority);
        TextView text = (TextView) convertView.findViewById(R.id.name);

        // Get relevant document revision
        DocumentRevision todoItem = mTodoItems.get(position);

        // Set TodoItem text
        String name = (String)todoItem.getBody().asMap().get(BlueListApplication.TODO_ITEM_NAME_KEY);
        text.setText(name);
        text.setTypeface(BlueListApplication.getInstance().getTypeFace());

        // Set TodoItem priority image
        int priority = (Integer) todoItem.getBody().asMap().get(BlueListApplication.TODO_ITEM_PRIORITY_KEY);
        button.setImageResource(getPriorityImageResourceId(priority));

        return convertView;
    }

    private int getPriorityImageResourceId(int priority) {
        switch (priority){
            case 1:
                return R.mipmap.medium;
            case 2:
                return R.mipmap.high;
            default:
                return R.mipmap.low;
        }
    }
}
