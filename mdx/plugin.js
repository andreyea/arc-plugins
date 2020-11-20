
arc.run(['$rootScope', function ($rootScope) {

   $rootScope.plugin("cubewiseMdx", "MDX", "page", {
      menu: "tools",
      icon: "fa-table",
      description: "This plugin can be used to test MDX queries.",
      author: "Cubewise",
      url: "https://github.com/cubewise-code/arc-plugins",
      version: "1.0.0"
   });

}]);

arc.directive("cubewiseMdx", function () {
   return {
      restrict: "EA",
      replace: true,
      scope: {
         instance: "=tm1Instance"
      },
      templateUrl: "__/plugins/mdx/template.html",
      link: function ($scope, element, attrs) {

      },
      controller: ["$scope", "$rootScope", "$http", "$tm1", "$translate", "$timeout", "$q", "$document", "$helper",
         function ($scope, $rootScope, $http, $tm1, $translate, $timeout, $q, $document, $helper) {

         // Store the active tab index
         $scope.selections = {
            activeTab: 0,
            queryCounter: 0
         };

         if(!$rootScope.uiPrefs.mdxSplitter){
            $rootScope.uiPrefs.mdxSplitter = "150px";
         }

         $rootScope.uiPrefs.showMDXChecked = true;
         $rootScope.uiPrefs.showMDXHistory = true;

         $scope.clearMDXHistory = function () {
            $rootScope.uiPrefs.mdxHistory = [];
         }

         $scope.clearMDXChecked = function () {
            $rootScope.uiPrefs.mdxChecked = [];
         }

         $scope.clearAllHistory = function () {
            $scope.clearMDXHistory();
            $scope.clearMDXChecked();
         }

         if (!$rootScope.uiPrefs.mdxHistory || $rootScope.uiPrefs.mdxHistory.length === 0) {
            $scope.clearMDXHistory();
         }
         
         if (!$rootScope.uiPrefs.mdxChecked || $rootScope.uiPrefs.mdxChecked.length === 0) {
            $scope.clearMDXChecked();
         }

         $scope.currentTabIndex = 1;

         $scope.options = {
            name: "",
            mdx: "SELECT \n"
            + "\tNON EMPTY {[Version].[Actual], [Version].[Budget]} ON COLUMNS, \n"
            + "\tNON EMPTY {TM1SUBSETALL([Account])} ON ROWS \n"
            + "FROM [General Ledger] \n"
            + "WHERE ([Department].[Corporate], [Year].[2012])",
            queryType:"ExecuteMDX",
            maxRows: 1000,
            message: null,
            showAttributes: false,
            showUniqueName: false,
            resultType: "table"
         };

         $scope.lists = {
            ExecuteMDX: [
               {
                  badge: 'badge-primary',
                  name: 'Cube',
                  query: "SELECT \n"
                     + "\tNON EMPTY {[Version].[Actual], [Version].[Budget]} ON COLUMNS, \n"
                     + "\tNON EMPTY {TM1SUBSETALL([Account])} ON ROWS \n"
                     + "FROM [General Ledger] \n"
                     + "WHERE ([Department].[Corporate], [Year].[2012])"
               }
            ],
            ExecuteMDXSetExpression: [
               { badge: 'badge-info', name: 'Dimension', query: '{TM1SUBSETALL( [Time] )}' },
               { badge: 'badge-info', name: 'Dimension Filter by Level', query: "{\n" + "\tTM1FILTERBYLEVEL(\n" + "\t{TM1SUBSETALL( [Employee] )}\n" + "\t, 0\n" + ")}" },
               { badge: 'badge-info', name: 'Dimension Filter by Attribute', query: "{\n" + "\tFILTER(\n" + "\t {TM1SUBSETALL( [Employee] )}\n" + "\t, \n" + "\t[Employee].[Region] = 'England'\n" + ")}" },
               { badge: 'badge-info', name: 'Dimension Filter by Windcard', query: "{\n" + "\tTM1FILTERBYPATTERN(\n" + "\t {\n" + "\tTM1SUBSETALL( [Employee] )}\n" + "\t, \n" + "\t'*Da*'\n)}" }
            ]
         };

         $scope.splitDown = function (e) {
            e.preventDefault();
            $scope.splitClicked = true;
            $scope.mdxTop = $(e.target).prev().offset().top + 7;
            $document.on('mousemove', $scope.splitMove);
            $document.on('mouseup', $scope.splitUp);
         };

         
   
         $scope.splitMove = function (e) {
            if ($scope.splitClicked) {
               var height = e.clientY - $scope.mdxTop;
               if(height < 0){
                  height = 0;
               }
               $rootScope.uiPrefs.mdxSplitter = height + "px";
               $scope.$apply();
            }
         };
   
         $scope.splitUp = function (e) {
            if ($scope.splitClicked) {
               $document.unbind('mousemove', $scope.splitMove);
               $document.unbind('mouseup', $scope.splitUp);
            }
            $scope.splitClicked = false;
            $scope.$broadcast("auto-height-resize");
         };

         $scope.closeTab = function (index) {
            // Remove a tab
            $scope.tabs.splice(index, 1);
         };

         $scope.tabSelected = function () {
            // This is required to resize the MDX panel after clicking on a tab
            //$scope.$broadcast("auto-height-resize");
         };

         $scope.toggleQuery = function (tab) {
            // Show and hide the query tab
            hideQuery = !hideQuery;
            $scope.$broadcast("auto-height-resize");
         };

         $scope.editorLoaded = function (_editor) {
            // Initialise the editor settings
            _editor.setTheme($rootScope.uiPrefs.editorTheme);
            _editor.getSession().setMode("ace/mode/mdx");
            _editor.getSession().setOptions({ tabSize: $rootScope.uiPrefs.editorTabSpaces, useSoftTabs: true });
            _editor.$blockScrolling = Infinity;
            _editor.setFontSize($rootScope.uiPrefs.fontSize);
            _editor.setShowPrintMargin(false);
                _editor.getSession().setUseWrapMode($rootScope.uiPrefs.editorWrapLongLines);
         };

         $scope.executing = false;
         $scope.execute = function(){
            
            $scope.executing = true;
            $scope.options.message = null;
            var sendDate = (new Date()).getTime();

            // Check for mdx set expression, otherwise dealing with mdx expression
            $scope.options.queryType = "ExecuteMDX";
            var pattern = new RegExp(/^\s*({)/, "g");
            var startsWithCurlyBracket = pattern.exec($scope.options.mdx);
            if(!_.isEmpty(startsWithCurlyBracket)){
               $scope.options.queryType = "ExecuteMDXSetExpression";
            }

            var url = "/" + $scope.options.queryType;
            if($scope.options.queryType==="ExecuteMDX"){
               url += "?$expand=Axes($expand=Hierarchies($select=Name;$expand=Dimension($select=Name)),Tuples($expand=Members($select=Name,UniqueName,Ordinal,Attributes))),Cells($select=Ordinal,Status,Value,FormatString,FormattedValue,Updateable,RuleDerived,Annotated,Consolidated,Language,HasDrillthrough)";
            } else {
               url += "?$expand=Hierarchies($select=Name;$expand=Dimension($select=Name)),Tuples($expand=Members($select=Name,UniqueName,Ordinal,Attributes))";
            }
            var data = {
               MDX: $scope.options.mdx
            };
            $tm1.post($scope.instance, url, data).then(function(success){
               $scope.executing = false;
               if (success.status === 401) {
                  return;

               } else if (success.status >= 400) {
                  $scope.options.message = $helper.errorText(success);
                  $scope.options.queryStatus = $helper.translate("FAILED");

               } else {
                  // Success
                  $scope.currentTabIndex = 0;
                  $scope.options.message = null;
                  $scope.options.queryStatus = $helper.translate("SUCCESS");

                  if ($scope.options.queryType==="ExecuteMDX") {
                     $tm1.cellsetDelete($scope.instance, success.data.ID);
                     var regex = /FROM\s*\[(.*)\]/g;
                     var match = regex.exec($scope.options.mdx);
                     var cube = match[1];
                     $scope.result = {
                        mdx: 'cube',
                        json: success.data,
                        table: $tm1.resultsetTransform($scope.instance, cube, success.data)
                     }

                  } else {
                     // Get attributes for each member
                     var table = _.cloneDeep(success.data.Tuples);
                     _.each(table, function(tuple){
                        tuple.attributeList = [];
                        _.each(tuple.Members, function(member){
                           var attr = _.clone(member.Attributes);
                           // Ignore captions
                           delete attr.Caption; 
                           delete attr.Caption_Default
                           memberAttributes = _.keys(attr);
                           _.each(memberAttributes, function(a){
                              tuple.attributeList.push(a);
                           });

                        });

                     });
                     $scope.result = {
                        mdx: 'dimension',
                        json: _.cloneDeep(success.data),
                        table: table
                     };

                  }

                  var receiveDate = (new Date()).getTime();
                  $scope.options.responseTimeMs = receiveDate - sendDate;

               }

               var newQuery = {
                  mdx: $scope.options.mdx,
                  message: $scope.options.message,
                  bookmark: false,
                  queryType: $scope.options.queryType,
                  queryStatus: $scope.options.queryStatus,
                  responseTimeMs: $scope.options.responseTimeMs,
                  name: $scope.options.name,
                  uniqueID: Math.random().toString(36).slice(2)
               }
               $rootScope.uiPrefs.mdxHistory.splice(0, 0, newQuery);

               // If more than 10 remove the last one
               if($rootScope.uiPrefs.mdxHistory.length > 99){
                  $rootScope.uiPrefs.mdxHistory.splice($rootScope.uiPrefs.mdxHistory.length - 1, 1);
               }

            });

         };

         $scope.removeOneQuery = function(queryToBeRemoved,index){
            $rootScope.uiPrefs.mdxHistory.splice(index, 1);
            _.each($rootScope.uiPrefs.mdxChecked, function (query, key) {
               if(query.uniqueID == queryToBeRemoved.uniqueID){
                  $rootScope.uiPrefs.mdxChecked.splice(key, 1);
               }
            });
         }

         $scope.removeOneQueryFromChecked = function(list, index, uniqueID){
            if(list == 'mdxChecked'){
            //Remove from checked
            $rootScope.uiPrefs.mdxChecked.splice(index, 1);
            //Remove Bookmark from History
            _.each($rootScope.uiPrefs.mdxHistory, function (query, key) {
               if(query.uniqueID == uniqueID){
                  query.bookmark = false;
               }
            });
            } else{
               $rootScope.uiPrefs.mdxHistory[index].bookmark = false;
               _.each($rootScope.uiPrefs.mdxChecked, function (query, key) {
                  if(query.uniqueID == uniqueID){
                     $rootScope.uiPrefs.mdxChecked.splice(key, 1);
                  }
               });
            }
         }

         $scope.moveOneQuery = function(query, index, move){
            if(move == 'top'){
               query.bookmark = true;
               $rootScope.uiPrefs.mdxChecked.push(query);
            } else if(move == 'up'){
               $rootScope.uiPrefs.mdxChecked.splice(index, 1);  
               if(index == 0){
                  $rootScope.uiPrefs.mdxChecked.push(query); 
               } else {
               $rootScope.uiPrefs.mdxChecked.splice(index-1, 0, query); 
               }
            } else {
               $rootScope.uiPrefs.mdxChecked.splice(index, 1); 
               if(index == $rootScope.uiPrefs.mdxChecked.length){
               $rootScope.uiPrefs.mdxChecked.splice(0, 0, query);  
               } else {
                  $rootScope.uiPrefs.mdxChecked.splice(index+1, 0, query);    
               }             
            }
         }

         $scope.indexTiFunctions = $rootScope.uiPrefs.mdxHistory.length - 1;

         $scope.updateCurrentQuery = function (item) {
            $scope.options.mdx = item.mdx;
            $scope.options.message = item.message;
            $scope.options.name = item.name;
            $scope.options.queryType = item.queryType;

         }

         $scope.updateindexTiFunctions = function (string) {
            if (string == "reset") {
               $scope.indexTiFunctions = $rootScope.uiPrefs.mdxHistory.length - 1;
            } else if (string == "+1") {
               var newindex = $scope.indexTiFunctions + 1;
               if (newindex > $rootScope.uiPrefs.mdxHistory.length - 1) {
                  $scope.indexTiFunctions = 0;
               } else {
                  $scope.indexTiFunctions = newindex;
               }
            } else if (string == "-1") {
               var newindex = $scope.indexTiFunctions - 1;
               if (newindex < 0) {
                  $scope.indexTiFunctions = $rootScope.uiPrefs.mdxHistory.length - 1;
               } else {
                  $scope.indexTiFunctions = newindex;
               }
            }
         };

         $scope.$on("login-reload", function (event, args) {

         });

         $scope.$on("close-tab", function (event, args) {
            // Event to capture when a user has clicked close on the tab
            if (args.page == "cubewiseMdx" && args.instance == $scope.instance && args.name == null) {
               // The page matches this one so close it
               $rootScope.close(args.page, { instance: $scope.instance });
            }
         });

         $scope.$on("$destroy", function (event) {

         });


      }]
   };
});