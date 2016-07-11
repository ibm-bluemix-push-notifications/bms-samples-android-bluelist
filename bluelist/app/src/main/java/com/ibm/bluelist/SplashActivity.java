package com.ibm.bluelist;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.Log;
import android.widget.TextView;
import android.widget.Toast;

import com.cloudant.sync.notifications.ReplicationCompleted;
import com.cloudant.sync.notifications.ReplicationErrored;
import com.cloudant.sync.replication.Replicator;
import com.google.common.eventbus.Subscribe;
import com.ibm.mobilefirstplatform.clientsdk.android.core.api.Response;
import com.ibm.mobilefirstplatform.clientsdk.android.core.api.ResponseListener;
import com.ibm.mobilefirstplatform.clientsdk.android.security.api.AuthorizationManager;
import com.ibm.mobilefirstplatform.clientsdk.android.security.facebookauthentication.FacebookAuthenticationManager;
import com.ibm.mobilefirstplatform.clientsdk.android.security.googleauthentication.GoogleAuthenticationManager;

import org.json.JSONObject;

/**
 * The {@code SplashActivity} is the splash dialog shown when the app is created for the first time.
 * During the splash, the BlueListApplication global variables are initialized and data is replicated from the remote database.
 * Authentication is also started in BlueListApplication.java while this activity obtains the auth header and handles the response if using Google or Facebook auth via ResponseListener implementation.
 */
public class SplashActivity extends Activity implements ResponseListener{
    private static final String TAG = SplashActivity.class.getCanonicalName();

    public void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_launch_screen);

        Typeface IBMFont = Typeface.createFromAsset(getAssets(), "fonts/helvetica-neue-light.ttf");

        TextView list = (TextView) findViewById(R.id.CopyrightText);
        list.setTypeface(IBMFont);
    }

    @Override
    public void onResume(){
        super.onResume();

        // Initialize application components
        Toast.makeText(getBaseContext(), "Initializing...", Toast.LENGTH_LONG).show();
        BlueListApplication.getInstance();

        AuthorizationManager.getInstance().obtainAuthorizationHeader(this, this);
    }

    /**
     * Handles response after attempting Facebook or Google login
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {

        String fb = getString(R.string.facebook_app_id);
        if (!fb.isEmpty()){
            Log.w("SplashActivity", "The facebook app id value in strings.xml is not empty. This may cause a null pointer if Google auth is configured on the backend.");
            FacebookAuthenticationManager.getInstance().onActivityResultCalled(requestCode, resultCode, data);
        }
        else{
            GoogleAuthenticationManager.getInstance().onActivityResultCalled(requestCode, resultCode, data);
        }
    }

    //ResponseListener
    @Override
    public void onSuccess(Response response) {
        BlueListApplication.getInstance().initialize();

        // Register a listener for pull replication
        final Replicator pullReplicator = BlueListApplication.getInstance().getPullReplicator();
        pullReplicator.getEventBus().register(new Object(){

            // Launch MainActivity when replication completes
            @Subscribe
            public void complete(ReplicationCompleted event) {
                pullReplicator.getEventBus().unregister(this);
                Log.d(TAG, String.format("Pull replication complete. %d documents replicated.", event.documentsReplicated));

                Intent intent = new Intent(SplashActivity.this, MainActivity.class);
                startActivity(intent);
                finish();
            }

            @Subscribe
            public void error(ReplicationErrored event) {
                throw new RuntimeException(event.errorInfo.getException());
            }
        });

        // Start pull replication
        pullReplicator.start();
    }

    @Override
    public void onFailure(Response response, Throwable t, JSONObject extendedInfo) {
        if(response != null) {
            Log.e("SplashActivityLoginFail", "Failed to login: Response: " + response.getResponseText());
        }else if (t != null){
            Log.e("SplashActivityLoginFail", "Failed to login: Throwable: " + t.getMessage());
        }else if (extendedInfo != null){
            Log.e("SplashActivityLoginFail", "Failed to login: ExtendedInfo: " + extendedInfo.toString());
        }
    }
}


