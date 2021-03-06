import ReactDOM from 'react-dom';
import React from 'react';
import Griddle from 'griddle-react';
import { Tooltip, OverlayTrigger, Button} from 'react-bootstrap';
import cookie from 'react-cookie';

// currently not used, need more testing, but it should be fast enough so loading message is not required
var Loading = React.createClass({
    getDefaultProps() {
        return {
            loadingText: "Loading"
        }
    },
    render(){
        return <div className="loading">{this.props.loadingText}</div>;
    }
});

var ApiCallWrapper = React.createClass({
    displayName: "ApiCallWrapper",

    render(){
        var apiCall = this.props.rowData.function;
        return (
            <div style={{overflow: 'hidden', textOverflow: 'ellipsis', direction:'rtl'}}> {apiCall} </div>
        )
    }
});

var ScenarioCallWrapper = React.createClass({
    displayName: "ScenarioCallWrapper",

    render(){
        var apiCall = this.props.rowData.scenario;
        return (
            <div style={{overflow: 'hidden', textOverflow: 'ellipsis'}}> {apiCall} </div>
        )
    }
});

var StatusLabelComponent = React.createClass({
    displayName: "StatusLabelComponent",

    getInitialState(){
        return {
            labelClass: 'label label-default'
        };
    },


    render() {

        var code = this.props.rowData.return_code;

        if (code >= 500) {
            this.state.labelClass = 'label label-danger';
        } else if (code >= 400) {
            this.state.labelClass = 'label label-warning';
        } else if (code >= 300) {
            this.state.labelClass = 'label label-primary';
        } else {
            this.state.labelClass = 'label label-success'
        }

        var StatusCodeTooltip = (
            <Tooltip>Stubo response to client was {this.props.rowData.return_code}. Check out documentation for
                more
                information.</Tooltip>
        );

        {
            // children status code label
            return (<OverlayTrigger placement='left' overlay={StatusCodeTooltip}>
                <span className={this.state.labelClass}> {this.props.rowData.return_code}</span>
            </OverlayTrigger>)
        }


    }
});

var DetailsButton = React.createClass({
    displayName: "DetailsButton",
    render() {
        const tooltip = (
            <Tooltip>Show details for this tracker record.</Tooltip>
        );

        var url = '/tracker/objects?href=' + this.props.data;
        return (
            <OverlayTrigger placement='left' overlay={tooltip}>
                <a href={url} className="btn btn-xs btn-info">
                            <span
                                className="glyphicon glyphicon-cloud-download"></span>
                    Details
                </a>
            </OverlayTrigger>
        );
    }
});

var ActionComponent = React.createClass({
    displayName: "ActionComponent",

    render() {


        // rendering action buttons
        return (<div className="btn-group">
                <DetailsButton data={this.props.rowData.href}/>
            </div>
        )
    }
});

var columnMeta = [
    {
        "columnName": "start_time",
        "displayName": "Time",
        "order": 1,
        "locked": false,
        "visible": true
    },
    {
        "columnName": "function",
        "displayName": "API call",
        "order": 2,
        "locked": false,
        "visible": true,
        "customComponent": ApiCallWrapper
    },
    {
        "columnName": "scenario",
        "displayName": "Scenario",
        "order": 3,
        "locked": false,
        "visible": true,
        "customComponent": ScenarioCallWrapper
    },
    {
        "columnName": "return_code",
        "displayName": "HTTP status code",
        "order": 4,
        "locked": false,
        "visible": true,
        "customComponent": StatusLabelComponent
    },
    {
        "columnName": "duration_ms",
        "displayName": "Response time (ms)",
        "order": 5,
        "locked": false,
        "visible": true
    },
    {
        "columnName": "delay",
        "displayName": "Delay (ms)",
        "order": 6,
        "locked": false,
        "visible": true
    },
    {
        "columnName": "actions",
        "displayName": "Actions",
        "order": 7,
        "locked": false,
        "visible": true,
        "customComponent": ActionComponent
    }

];

var RecordsComponent = React.createClass({
    getInitialState(){
        var initial = {
            "currentPage": 0,
            "isLoading": false,
            "maxPages": 0,
            "externalResultsPerPage": 25,
            "externalSortColumn": null,
            "externalSortAscending": true,
            "results": [],
            "currentQuery": "",
            "ws": null,
            "wsQuery": {
                "skip": 0,
                "q": null,
                "limit": 25
            }
        };

        return initial;
    },

    componentWillMount() {
        if ("WebSocket" in window) {
            this.state.ws = new WebSocket("ws:/" + window.location.host + "/api/ws/tracker");

            let that = this;
            this.state.ws.onclose = function () {
                console.log("Connection is closed ...");
                that.state.ws = null;
            };

        } else {
            console.log("WebSocket not supported by your browser.");
        }

    },

    componentDidMount() {
        this.getExternalData();
    },
    getExternalData(page) {
        var that = this;
        page = page || 1;

        var skip = (page - 1) * 25;

        if (this.state.ws != null && this.state.ws.readyState == 1) {
            that.state.wsQuery['skip'] = skip;
            // websockets supported, communicating through them
            that.state.ws.send(JSON.stringify(that.state.wsQuery));

            // getting response with data
            this.state.ws.onmessage = function (e) {
                var data = JSON.parse(e.data);
                that.setState({
                    results: data.data,
                    currentPage: page - 1,
                    maxPages: Math.round(data.paging.totalItems / 25),
                    isLoading: false
                });

            };
        } else {
            // fallback to regular queries
            var query = '?skip=' + skip;

            var allHosts = "";

            if (cookie.load('stubo.all-hosts') || false) {
                allHosts = "&all-hosts=true";
            }

            var href = '/api/v2/tracker/records' + query + '&limit=25' + allHosts + '&q=' + this.state.currentQuery;

            $.get(href, function (data) {

                that.setState({
                    results: data.data,
                    currentPage: page - 1,
                    maxPages: Math.round(data.paging.totalItems / 25),
                    isLoading: false
                });

            });
        }

    },
    setPage(index) {
        //This should interact with the data source to get the page at the given index
        index = index > this.state.maxPages ? this.state.maxPages : index < 1 ? 1 : index + 1;
        this.getExternalData(index);
    },
    setPageSize(size) {
    },

    setFilter(filter) {
        var that = this;

        if (this.state.ws != null) {
            that.state.wsQuery['q'] = filter;
            // websockets supported, communicating through them
            that.state.ws.send(JSON.stringify(that.state.wsQuery));

            // getting response with data
            this.state.ws.onmessage = function (e) {
                var data = JSON.parse(e.data);
                that.setState({
                    results: data.data,
                    currentPage: 0,
                    maxPages: Math.round(data.paging.totalItems / 25),
                    isLoading: false,
                    currentQuery: filter
                });

            };
        } else {
            // do this if browser does not support websockets

            var href = '/api/v2/tracker/records?skip=0&limit=25' + '&q=' + filter;

            $.get(href, function (data) {
                that.setState({
                    results: data.data,
                    currentPage: 0,
                    maxPages: Math.round(data.paging.totalItems / 25),
                    isLoading: false,
                    currentQuery: filter
                });

            });
        }

    },

    render() {
        return <Griddle useExternal={true}
                        externalSetPage={this.setPage}
                        enableSort={false}
                        columns={["start_time", "function", "scenario", "return_code", "duration_ms", "delay", "actions"]}
                        columnMetadata={columnMeta}

                        externalSetPageSize={this.setPageSize}
                        externalMaxPage={this.state.maxPages}
                        externalChangeSort={function(){}}

                        filterPlaceholderText={'Filter results, use "rt" for response time,' +
                             '"sc" for status code, "d" for delay. Example: "scenario_1 sc:200 rt:<=500 d:200"'}
                        externalSetFilter={this.setFilter}
                        showFilter={true}

                        externalCurrentPage={this.state.currentPage}

                        results={this.state.results}
                        tableClassName="table"

                        resultsPerPage={this.state.externalResultsPerPage}

                        externalSortColumn={this.state.externalSortColumn}
                        externalSortAscending={this.state.externalSortAscending}

                        externalLoadingComponent={Loading}
                        externalIsLoading={this.state.isLoading}/>
    }
});


ReactDOM.render(<RecordsComponent />, document.getElementById("app"));